//! Locating bundled Acts and provisioning mutable game instances from them.
//!
//! Every path in here is derived at runtime from Tauri's resource/data
//! directories. Nothing is hardcoded to a developer machine, which is what lets
//! a packaged `.msi`/`.deb` create a table on someone else's computer.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::network::protocol::SheetSummary;
use crate::storage;

/// Directory that holds the read-only bundled Acts.
///
/// In a packaged build these ship as Tauri resources. In `tauri dev` the
/// resource directory is the target folder, so we fall back to the repository
/// checkout to keep the dev loop working without a rebuild.
pub fn templates_root(app: &AppHandle) -> Result<PathBuf, String> {
    // PRIORIDADE 1: Em modo de desenvolvimento, ler direto da pasta raiz do seu código.
    // Isso impede que o Tauri use um cache defasado quando você adiciona arquivos novos.
    #[cfg(debug_assertions)]
    {
        let checkout = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(|root| root.join("campaigns"));

        if let Some(checkout) = checkout {
            if checkout.is_dir() {
                return Ok(checkout);
            }
        }
    }

    // PRIORIDADE 2: Ler dos recursos compilados (usado apenas no app de produção final).
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("campaigns");
        if bundled.is_dir() {
            return Ok(bundled);
        }
    }

    Err("Could not locate the bundled campaigns directory.".into())
}

/// Where mutable game instances live. Kept under the app's local data dir so it
/// survives updates and never needs write access to the install location.
pub fn instances_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not resolve the application data directory: {}", e))?
        .join("games");
    std::fs::create_dir_all(&base)
        .map_err(|e| format!("Could not create {}: {}", base.display(), e))?;
    Ok(base)
}

/// Reject anything that could escape the directories we manage.
fn safe_component(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{} cannot be empty.", label));
    }
    let clean = trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !clean {
        return Err(format!(
            "Invalid {}: '{}'. Only letters, digits, '_' and '-' are allowed.",
            label, trimmed
        ));
    }
    Ok(trimmed.to_string())
}

pub fn instance_path(app: &AppHandle, game_id: &str, act_id: &str) -> Result<PathBuf, String> {
    let game_id = safe_component(game_id, "game id")?;
    let act_id = safe_component(act_id, "act id")?;
    Ok(instances_root(app)?.join(format!("{}_{}", game_id, act_id)))
}

/// Create an independent, mutable copy of an Act. Existing instances are left
/// alone so reopening a table never resets anyone's sheet.
pub fn ensure_instance(app: &AppHandle, game_id: &str, act_id: &str) -> Result<PathBuf, String> {
    let destination = instance_path(app, game_id, act_id)?;
    if destination.is_dir() && has_sheets(&destination) {
        return Ok(destination);
    }

    let act_id = safe_component(act_id, "act id")?;
    let source = templates_root(app)?.join(&act_id).join("templates");
    if !source.is_dir() {
        return Err(format!(
            "Act '{}' has no templates directory at {}.",
            act_id,
            source.display()
        ));
    }

    storage::copy_dir_all(&source, &destination)
        .map_err(|e| format!("Failed to provision the game instance: {}", e))?;

    tracing::info!(
        game_id,
        act_id,
        destination = %destination.display(),
        "provisioned game instance"
    );
    Ok(destination)
}

pub fn delete_instance(app: &AppHandle, game_id: &str, act_id: &str) -> Result<(), String> {
    let target = instance_path(app, game_id, act_id)?;
    let root = instances_root(app)?;
    // Belt and braces: never remove anything outside the instances directory.
    if !target.starts_with(&root) {
        return Err("Refusing to delete a directory outside the games folder.".into());
    }
    if target.is_dir() {
        std::fs::remove_dir_all(&target)
            .map_err(|e| format!("Failed to delete {}: {}", target.display(), e))?;
    }
    Ok(())
}

fn has_sheets(directory: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return false;
    };
    entries.filter_map(Result::ok).any(|entry| {
        entry
            .path()
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
    })
}

/// Resolve a sheet id (a bare file name such as `alan.md`) inside a game root.
///
/// This is the only way the network layer turns client input into a path, so a
/// malicious client cannot ask for `../../../etc/passwd`.
pub fn resolve_sheet(root: &Path, sheet_id: &str) -> Result<PathBuf, String> {
    let trimmed = sheet_id.trim();
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err(format!(
            "Invalid sheet id '{}': expected a bare file name.",
            sheet_id
        ));
    }
    storage::resolve_within(root, trimmed)
}

/// Summarise every character file in a game instance, sorted by file name so
/// the selection list is stable between launches and identical for everyone.
pub fn list_sheets(root: &Path) -> Result<Vec<SheetSummary>, String> {
    let entries =
        std::fs::read_dir(root).map_err(|e| format!("Failed to read {}: {}", root.display(), e))?;

    let mut files: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
        })
        .collect();
    files.sort();

    let mut summaries = Vec::new();
    for path in files {
        let Some(id) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Some(path_str) = path.to_str() else {
            continue;
        };
        match storage::read_document(path_str) {
            Ok(document) => summaries.push(SheetSummary {
                id: id.to_string(),
                name: document.data.name,
                profile: document.data.profile,
                occupation: document.data.occupation,
                level: document.data.level,
            }),
            // One malformed file must not hide the rest of the party.
            Err(reason) => tracing::warn!(sheet = id, %reason, "skipping unreadable sheet"),
        }
    }
    Ok(summaries)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("guia-campaign-{tag}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_sheet(dir: &Path, file: &str, name: &str, profile: &str) {
        let contents = format!(
            "---\ntype: character\nname: {name}\nprofile: {profile}\noccupation: TESTE\nlevel: 2\nresources:\n  hp:\n    current: 10\n    max: 10\n  dp:\n    current: 5\n    max: 5\nattributes:\n  physical: 6\n  mind: 6\n  emotion: 6\n---\n# Notas\n"
        );
        std::fs::write(dir.join(file), contents).unwrap();
    }

    #[test]
    fn sheet_ids_cannot_escape_the_game_directory() {
        let root = Path::new("/games/mesa");
        assert!(resolve_sheet(root, "../secret.md").is_err());
        assert!(resolve_sheet(root, "nested/alan.md").is_err());
        assert!(resolve_sheet(root, "/etc/passwd.md").is_err());
        assert!(resolve_sheet(root, "alan.txt").is_err());

        let resolved = resolve_sheet(root, "alan.md").unwrap();
        assert!(resolved.starts_with(root));
    }

    #[test]
    fn game_and_act_ids_are_restricted_to_safe_characters() {
        assert!(safe_component("act_1", "act id").is_ok());
        assert!(safe_component("mf1k2j", "game id").is_ok());
        assert!(safe_component("../etc", "act id").is_err());
        assert!(safe_component("act 1", "act id").is_err());
        assert!(safe_component("  ", "act id").is_err());
    }

    #[test]
    fn sheets_are_listed_alphabetically_and_summarised() {
        let dir = scratch("list");
        write_sheet(&dir, "victor.md", "VICTOR", "VIGILANTE");
        write_sheet(&dir, "alan.md", "ALAN", "EXECUTOR");
        std::fs::write(dir.join("notes.txt"), "ignored").unwrap();

        let sheets = list_sheets(&dir).unwrap();
        assert_eq!(sheets.len(), 2);
        assert_eq!(sheets[0].id, "alan.md");
        assert_eq!(sheets[0].name, "ALAN");
        assert_eq!(sheets[0].profile, "EXECUTOR");
        assert_eq!(sheets[1].id, "victor.md");
    }

    #[test]
    fn an_unreadable_sheet_does_not_hide_the_others() {
        let dir = scratch("broken");
        write_sheet(&dir, "alan.md", "ALAN", "EXECUTOR");
        std::fs::write(dir.join("broken.md"), "no frontmatter here").unwrap();

        let sheets = list_sheets(&dir).unwrap();
        assert_eq!(sheets.len(), 1);
        assert_eq!(sheets[0].id, "alan.md");
    }
}

use crate::models::Handout;

pub fn resolve_handout(root: &Path, handout_id: &str) -> Result<PathBuf, String> {
    let trimmed = handout_id.trim();
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err(format!("Invalid handout id: {}", handout_id));
    }
    let mut path = root.join("handouts").join(trimmed);
    path.set_extension("md");
    Ok(path)
}

pub fn list_handouts(root: &Path) -> Result<Vec<Handout>, String> {
    let dir = root.join("handouts");
    let mut handouts = Vec::new();

    if !dir.is_dir() {
        // DETECTOR DE ERRO 1: A PASTA NÃO FOI COPIADA OU NÃO EXISTE
        handouts.push(crate::models::Handout {
            id: "error_folder".to_string(),
            title: "⚠️ ERRO: Pasta Não Encontrada".to_string(),
            category: "regras".to_string(),
            content_type: "text".to_string(),
            is_public: true,
            shared_with: vec![],
            content: format!("O G.U.I.A tentou procurar a pasta de handouts no seguinte caminho:\n\n{}\n\nSe você acabou de criar a pasta no seu código, certifique-se de clicar em 'Nova Campanha' na tela inicial para que o sistema copie a pasta.", dir.display()),
        });
        return Ok(handouts);
    }

    let entries = std::fs::read_dir(&dir).map_err(|e| format!("Failed to read handouts: {}", e))?;
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            if let Some(id) = path.file_stem().and_then(|n| n.to_str()) {
                if let Ok(raw) = std::fs::read_to_string(&path) {
                    match crate::storage::parse_handout(id, &raw) {
                        Ok(handout) => handouts.push(handout),
                        Err(e) => {
                            // DETECTOR DE ERRO 2: O ARQUIVO ESTÁ ESCRITO ERRADO
                            handouts.push(crate::models::Handout {
                                id: format!("error_{}", id),
                                title: format!("⚠️ ERRO: {}", id),
                                category: "documentos".to_string(),
                                content_type: "text".to_string(),
                                is_public: true,
                                shared_with: vec![],
                                content: format!(
                                    "Falha ao ler o arquivo {}.md.\n\nMotivo:\n{}",
                                    id, e
                                ),
                            });
                        }
                    }
                }
            }
        }
    }

    if handouts.is_empty() {
        // DETECTOR DE ERRO 3: A PASTA EXISTE, MAS ESTÁ VAZIA
        handouts.push(crate::models::Handout {
            id: "error_empty".to_string(),
            title: "⚠️ ERRO: Pasta Vazia".to_string(),
            category: "documentos".to_string(),
            content_type: "text".to_string(),
            is_public: true,
            shared_with: vec![],
            content: format!(
                "A pasta existe em:\n{}\n\nMas não há nenhum arquivo .md dentro dela.",
                dir.display()
            ),
        });
    }

    Ok(handouts)
}
