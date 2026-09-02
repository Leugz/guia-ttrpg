//! Markdown + YAML persistence for character documents.
//!
//! Spec references: §3.1 (Markdown is the canonical source of truth),
//! §5 (atomic writes), §6 (path traversal protection).
//!
//! `gray_matter` splits the document; the frontmatter itself is deserialized
//! with `serde_yaml` so the numeric dice representation and the lenient
//! normalization rules in §3.2/§6 apply consistently.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use crate::models::{CharacterSheet, ParsedDocument};

/// Rejects anything that is not a Markdown file or that tries to walk out of its
/// directory with `..` (§6).
pub fn safe_path(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);

    if candidate
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("Path traversal is not allowed.".into());
    }

    match candidate.extension().and_then(|ext| ext.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("md") => Ok(candidate),
        _ => Err("Only Markdown (.md) documents can be read or written.".into()),
    }
}

/// Resolves a campaign-relative reference (such as an entry of
/// `accessible_sheets`) against the campaign root, refusing to escape it.
pub fn resolve_within(root: &Path, reference: &str) -> Result<PathBuf, String> {
    let relative = PathBuf::from(reference);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(format!(
            "Reference '{}' escapes the campaign directory.",
            reference
        ));
    }
    let joined = root.join(relative);
    match joined.extension().and_then(|ext| ext.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("md") => Ok(joined),
        _ => Err("Only Markdown (.md) documents can be referenced.".into()),
    }
}

/// Splits a raw document into its frontmatter struct and Markdown body.
pub fn parse_document(raw: &str) -> Result<ParsedDocument, String> {
    let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
    let parsed = matter.parse(raw);

    if parsed.data.is_none() || parsed.matter.trim().is_empty() {
        return Err("No YAML frontmatter found in document.".into());
    }

    let mut data: CharacterSheet = serde_yaml::from_str(&parsed.matter)
        .map_err(|e| format!("Invalid character sheet schema: {}", e))?;

    // Repair what can be repaired before enforcing the hard rules (§6).
    let notes = data.normalize();
    data.validate()?;

    Ok(ParsedDocument {
        data,
        body: parsed.content,
        notes,
    })
}

/// Renders a sheet back into a Markdown document.
pub fn render_document(sheet: &CharacterSheet, body: &str) -> Result<String, String> {
    let yaml = serde_yaml::to_string(sheet)
        .map_err(|e| format!("Failed to serialize YAML: {}", e))?;
    Ok(format!("---\n{}---\n{}", yaml, body))
}

/// Reads and parses a character document from disk.
pub fn read_document(path: &str) -> Result<ParsedDocument, String> {
    let path = safe_path(path)?;
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file at {}: {}", path.display(), e))?;
    parse_document(&raw)
}

/// Validates and writes a character document atomically.
pub fn write_document(path: &str, sheet: &CharacterSheet, body: &str) -> Result<(), String> {
    sheet.validate()?;
    let path = safe_path(path)?;
    let contents = render_document(sheet, body)?;
    write_atomic(&path, &contents)
}

/// Writes to a sibling temporary file, flushes it to disk, then renames over the
/// target. A power loss mid-write leaves the original document intact (§5).
pub fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    fs::create_dir_all(&parent)
        .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Invalid destination file name.")?;
    let temp_path = parent.join(format!(".{}.tmp", file_name));

    {
        let mut file = File::create(&temp_path)
            .map_err(|e| format!("Failed to create temporary file: {}", e))?;
        file.write_all(contents.as_bytes())
            .map_err(|e| format!("Failed to write temporary file: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("Failed to flush temporary file: {}", e))?;
    }

    fs::rename(&temp_path, path).map_err(|e| {
        // Leave no stray temporary files behind if the rename fails.
        let _ = fs::remove_file(&temp_path);
        format!("Failed to overwrite {}: {}", path.display(), e)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dice::StepDice;
    use std::path::PathBuf;

    const DOCUMENT: &str = r#"---
type: character
name: Elian Thorne
profile: Combatente
occupation: Mercenário
level: 1
resources:
  hp:
    current: 18
    max: 20
  dp:
    current: 9
    max: 10
base_attributes:
  physical: D8
  mind: D6
  emotion: D4
abilities:
- name: Ataque Especial
  description: Adiciona +1d8 ao dano
  active: false
---
# Histórico do Personagem

Conteúdo livre do jogador.
"#;

    fn scratch_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("guia-storage-{tag}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn frontmatter_and_body_are_separated() {
        let parsed = parse_document(DOCUMENT).unwrap();
        assert_eq!(parsed.data.name, "Elian Thorne");
        assert_eq!(parsed.data.attributes.physical, StepDice::D8);
        assert!(parsed.body.contains("Histórico do Personagem"));
    }

    #[test]
    fn documents_without_frontmatter_are_rejected() {
        assert!(parse_document("Just a note.").is_err());
    }

    #[test]
    fn malformed_frontmatter_reports_an_error_instead_of_panicking() {
        let broken = "---\nname: [unclosed\n---\nbody";
        assert!(parse_document(broken).is_err());
    }

    #[test]
    fn a_document_survives_a_round_trip() {
        let parsed = parse_document(DOCUMENT).unwrap();
        let rendered = render_document(&parsed.data, &parsed.body).unwrap();
        let reparsed = parse_document(&rendered).unwrap();
        assert_eq!(reparsed.data.name, parsed.data.name);
        assert_eq!(reparsed.data.attributes.mind, StepDice::D6);
        assert_eq!(reparsed.body.trim(), parsed.body.trim());
        assert!(rendered.contains("physical: 8"), "{rendered}");
    }

    #[test]
    fn writes_replace_the_file_and_leave_no_temporary_behind() {
        let dir = scratch_dir("write");
        let path = dir.join("ficha.md");
        let parsed = parse_document(DOCUMENT).unwrap();

        write_document(path.to_str().unwrap(), &parsed.data, &parsed.body).unwrap();
        let reloaded = read_document(path.to_str().unwrap()).unwrap();
        assert_eq!(reloaded.data.name, "Elian Thorne");

        let leftovers: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn invalid_sheets_are_never_written_to_disk() {
        let dir = scratch_dir("invalid");
        let path = dir.join("ficha.md");
        let mut parsed = parse_document(DOCUMENT).unwrap();
        parsed.data.level = 0;
        assert!(write_document(path.to_str().unwrap(), &parsed.data, &parsed.body).is_err());
        assert!(!path.exists());
    }

    #[test]
    fn path_traversal_is_refused() {
        assert!(safe_path("../../etc/passwd.md").is_err());
        assert!(safe_path("campanha/../../fora.md").is_err());
        assert!(safe_path("campanha/ficha.txt").is_err());
        assert!(safe_path("campanha/ficha.md").is_ok());
    }

    #[test]
    fn campaign_references_stay_inside_the_campaign_root() {
        let root = Path::new("/campanhas/ordem");
        assert!(resolve_within(root, "../secreto.md").is_err());
        assert!(resolve_within(root, "/etc/passwd.md").is_err());
        let resolved = resolve_within(root, "personagens/joao.md").unwrap();
        assert!(resolved.starts_with(root));
    }
}
