use std::fs::{self, File};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use crate::models::{CharacterSheet, ParsedDocument};

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

/// Like `resolve_within`, but for the binary image an image-handout's body
/// points at, rather than a Markdown document. Only the allowed extension
/// list differs — traversal outside the campaign root is still refused.
pub fn resolve_asset_within(root: &Path, reference: &str) -> Result<PathBuf, String> {
    let relative = PathBuf::from(reference.trim());
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
    match joined
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("jpg") | Some("jpeg") | Some("png") | Some("gif") | Some("webp") => Ok(joined),
        _ => Err("Only image assets (jpg, jpeg, png, gif, webp) can be referenced.".into()),
    }
}

/// Best-effort MIME type for an image asset, used when handing raw bytes to a
/// remote client instead of letting it resolve the path itself.
pub fn mime_for_asset(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        _ => "image/jpeg",
    }
}

/// Minimal standard-alphabet base64 encoder (with padding). Small enough to
/// hand-roll rather than pull in a whole extra crate just to ship a handful
/// of handout images over the LAN socket.
pub fn base64_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);

        out.push(ALPHABET[(b0 >> 2) as usize] as char);
        out.push(ALPHABET[(((b0 & 0b11) << 4) | (b1 >> 4)) as usize] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[(((b1 & 0b1111) << 2) | (b2 >> 6)) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[(b2 & 0b111111) as usize] as char
        } else {
            '='
        });
    }
    out
}

pub fn parse_document(raw: &str) -> Result<ParsedDocument, String> {
    let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
    let parsed = matter.parse(raw);
    if parsed.data.is_none() || parsed.matter.trim().is_empty() {
        return Err("No YAML frontmatter found in document.".into());
    }
    let mut data: CharacterSheet = serde_yaml::from_str(&parsed.matter)
        .map_err(|e| format!("Invalid character sheet schema: {}", e))?;
    let notes = data.normalize();
    data.validate()?;
    Ok(ParsedDocument {
        data,
        body: parsed.content,
        notes,
    })
}

pub fn render_document(sheet: &CharacterSheet, body: &str) -> Result<String, String> {
    let yaml =
        serde_yaml::to_string(sheet).map_err(|e| format!("Failed to serialize YAML: {}", e))?;
    Ok(format!("---\n{}---\n{}", yaml, body))
}

pub fn read_document(path: &str) -> Result<ParsedDocument, String> {
    let path = safe_path(path)?;
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file at {}: {}", path.display(), e))?;
    parse_document(&raw)
}

pub fn write_document(path: &str, sheet: &CharacterSheet, body: &str) -> Result<(), String> {
    sheet.validate()?;
    let path = safe_path(path)?;
    let contents = render_document(sheet, body)?;
    write_atomic(&path, &contents)
}

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
        let _ = fs::remove_file(&temp_path);
        format!("Failed to overwrite {}: {}", path.display(), e)
    })
}

// --- NEW: Recursive folder clone logic ---
pub fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
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

    #[test]
    fn image_asset_references_stay_inside_the_campaign_root() {
        let root = Path::new("/campanhas/ordem");
        assert!(resolve_asset_within(root, "../secreto.jpg").is_err());
        assert!(resolve_asset_within(root, "/etc/passwd.png").is_err());
        assert!(resolve_asset_within(root, "assets/mapa.md").is_err());

        let resolved = resolve_asset_within(root, "assets/mapa_da_mansao.jpg").unwrap();
        assert!(resolved.starts_with(root));
    }

    #[test]
    fn mime_types_are_guessed_from_the_extension() {
        assert_eq!(mime_for_asset(Path::new("a/b.PNG")), "image/png");
        assert_eq!(mime_for_asset(Path::new("a/b.gif")), "image/gif");
        assert_eq!(mime_for_asset(Path::new("a/b.webp")), "image/webp");
        assert_eq!(mime_for_asset(Path::new("a/b.jpg")), "image/jpeg");
        assert_eq!(mime_for_asset(Path::new("a/b.jpeg")), "image/jpeg");
    }

    #[test]
    fn base64_encoding_matches_known_vectors() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }
}

use crate::models::Handout;

pub fn parse_handout(id: &str, raw: &str) -> Result<Handout, String> {
    let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
    let parsed = matter.parse(raw);

    if parsed.data.is_none() || parsed.matter.trim().is_empty() {
        return Err(
            "Nenhum YAML Frontmatter encontrado no topo do arquivo (certifique-se de usar ---)."
                .into(),
        );
    }

    #[derive(serde::Deserialize)]
    struct Frontmatter {
        title: String,
        #[serde(default)]
        category: String,
        #[serde(default = "crate::models::default_content_type")]
        content_type: String,
        #[serde(default)]
        is_public: bool,
        #[serde(default)]
        shared_with: Vec<String>,
    }

    let fm: Frontmatter = serde_yaml::from_str(&parsed.matter)
        .map_err(|e| format!("Erro no formato do YAML: {}", e))?;

    Ok(Handout {
        id: id.to_string(),
        title: fm.title,
        category: fm.category,
        content_type: fm.content_type,
        is_public: fm.is_public,
        shared_with: fm.shared_with,
        content: parsed.content,
    })
}

pub fn render_handout(handout: &Handout) -> Result<String, String> {
    #[derive(serde::Serialize)]
    struct Frontmatter<'a> {
        #[serde(rename = "type")]
        doc_type: &'a str,
        title: &'a str,
        category: &'a str,
        content_type: &'a str,
        is_public: bool,
        shared_with: &'a [String],
    }

    let fm = Frontmatter {
        doc_type: "handout",
        title: &handout.title,
        category: &handout.category,
        content_type: &handout.content_type,
        is_public: handout.is_public,
        shared_with: &handout.shared_with,
    };

    let yaml =
        serde_yaml::to_string(&fm).map_err(|e| format!("Failed to serialize YAML: {}", e))?;
    Ok(format!("---\n{}---\n{}", yaml, handout.content))
}
