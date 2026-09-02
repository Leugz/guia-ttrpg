//! Mathematical engine for step-dice, pool resolution and critical detection.
//!
//! Spec references: §3.2 (numeric dice representation), §4.10 (core resolution),
//! §4.11 (RA/RB), §4.12 (criticals), §6 (graceful YAML degradation).
//!
//! Dice are stored as the *numeric size of the die* (4, 6, 8, 10, 12). They are
//! never stored as strings such as `"d8"`. The UI is responsible for rendering
//! the numeric value as conventional dice notation.

use rand::Rng;
use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;

/// The only valid step-dice sizes, in ascending order.
pub const STEP_LADDER: [u8; 5] = [4, 6, 8, 10, 12];

/// Every die the roller is allowed to produce (step dice plus the d20).
pub const ROLLABLE_SIDES: [u8; 6] = [4, 6, 8, 10, 12, 20];

/// Maximum number of dice in a single test pool (§4.10, final decision #8).
pub const MAX_POOL_SIZE: usize = 4;

/// Number of dice that actually contribute to the total (§4.10, final decision #9).
pub const COUNTED_DICE: usize = 3;

/// A single die is "high" for critical purposes at this value or above (§4.12).
pub const CRITICAL_SUCCESS_THRESHOLD: u32 = 6;

/// How many high dice are required for a critical success (§4.12).
pub const CRITICAL_SUCCESS_COUNT: usize = 2;

/// A step die as used by attributes, skills and step-based effects.
///
/// Serializes to a plain integer (`8`), and deserializes from an integer, a
/// float, or a legacy string (`"D8"`, `"d8"`, `"8"`). Unsupported values are
/// normalized to the nearest valid step instead of failing the whole document
/// (§6, YAML Validation).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum StepDice {
    D4,
    D6,
    D8,
    D10,
    D12,
}

impl StepDice {
    /// The step ladder in ascending order: 4 -> 6 -> 8 -> 10 -> 12.
    pub const LADDER: [StepDice; 5] = [
        StepDice::D4,
        StepDice::D6,
        StepDice::D8,
        StepDice::D10,
        StepDice::D12,
    ];

    /// Numeric size of the die, i.e. the value stored in YAML.
    pub fn sides(self) -> u8 {
        match self {
            StepDice::D4 => 4,
            StepDice::D6 => 6,
            StepDice::D8 => 8,
            StepDice::D10 => 10,
            StepDice::D12 => 12,
        }
    }

    /// Position on the step ladder (0..=4).
    pub fn index(self) -> usize {
        match self {
            StepDice::D4 => 0,
            StepDice::D6 => 1,
            StepDice::D8 => 2,
            StepDice::D10 => 3,
            StepDice::D12 => 4,
        }
    }

    /// Strict conversion. Returns `None` for anything outside the ladder.
    pub fn from_sides(value: i64) -> Option<Self> {
        match value {
            4 => Some(StepDice::D4),
            6 => Some(StepDice::D6),
            8 => Some(StepDice::D8),
            10 => Some(StepDice::D10),
            12 => Some(StepDice::D12),
            _ => None,
        }
    }

    /// Lenient conversion used when reading user-authored YAML.
    ///
    /// Values below the ladder clamp to `D4`, values above clamp to `D12`, and
    /// in-between values resolve to the nearest valid step. Ties resolve
    /// downward so a malformed sheet never silently inflates a character.
    pub fn nearest(value: i64) -> Self {
        if value <= 4 {
            return StepDice::D4;
        }
        if value >= 12 {
            return StepDice::D12;
        }
        let mut best = StepDice::D4;
        let mut best_distance = i64::MAX;
        for step in StepDice::LADDER {
            let distance = (step.sides() as i64 - value).abs();
            if distance < best_distance {
                best_distance = distance;
                best = step;
            }
        }
        best
    }

    /// Parses the legacy string representation (`"D8"`, `"d8"`, `"8"`).
    pub fn from_legacy_str(raw: &str) -> Option<Self> {
        let trimmed = raw.trim();
        let digits = trimmed.trim_start_matches(['d', 'D']);
        digits.parse::<i64>().ok().and_then(Self::from_sides)
    }

    /// Moves the die along the ladder, hard-clamping between `D4` and `D12`
    /// (§4.5). Positive values advance, negative values regress.
    pub fn apply_steps(self, steps: i32) -> Self {
        let target = (self.index() as i32 + steps).clamp(0, (STEP_LADDER.len() - 1) as i32);
        StepDice::LADDER[target as usize]
    }

    /// Conventional dice notation for display and log messages.
    pub fn notation(self) -> String {
        format!("d{}", self.sides())
    }
}

impl fmt::Display for StepDice {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.notation())
    }
}

impl Serialize for StepDice {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_u8(self.sides())
    }
}

impl<'de> Deserialize<'de> for StepDice {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(StepDiceVisitor)
    }
}

struct StepDiceVisitor;

impl<'de> Visitor<'de> for StepDiceVisitor {
    type Value = StepDice;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a die size of 4, 6, 8, 10 or 12")
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> Result<StepDice, E> {
        Ok(StepDice::from_sides(value).unwrap_or_else(|| {
            let normalized = StepDice::nearest(value);
            tracing::warn!(
                invalid = value,
                normalized = normalized.sides(),
                "unsupported step die normalized to nearest valid value"
            );
            normalized
        }))
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> Result<StepDice, E> {
        self.visit_i64(value as i64)
    }

    fn visit_f64<E: de::Error>(self, value: f64) -> Result<StepDice, E> {
        self.visit_i64(value.round() as i64)
    }

    fn visit_str<E: de::Error>(self, value: &str) -> Result<StepDice, E> {
        if let Some(die) = StepDice::from_legacy_str(value) {
            return Ok(die);
        }
        let fallback = value
            .trim()
            .trim_start_matches(['d', 'D'])
            .parse::<i64>()
            .map(StepDice::nearest)
            .unwrap_or(StepDice::D4);
        tracing::warn!(
            invalid = value,
            normalized = fallback.sides(),
            "unsupported step die string normalized to nearest valid value"
        );
        Ok(fallback)
    }
}

/// Any die the roller can physically roll, including the d20 used by the free
/// dice roller (§4.3). Character values always use [`StepDice`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Die(u8);

impl Die {
    /// Strict constructor. Rejects sizes outside [`ROLLABLE_SIDES`].
    pub fn new(sides: u8) -> Result<Self, String> {
        if ROLLABLE_SIDES.contains(&sides) {
            Ok(Die(sides))
        } else {
            Err(format!(
                "Unsupported die size: d{}. Supported dice are d4, d6, d8, d10, d12 and d20.",
                sides
            ))
        }
    }

    pub fn sides(self) -> u8 {
        self.0
    }

    pub fn notation(self) -> String {
        format!("d{}", self.0)
    }
}

impl From<StepDice> for Die {
    fn from(step: StepDice) -> Self {
        Die(step.sides())
    }
}

impl Serialize for Die {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_u8(self.0)
    }
}

impl<'de> Deserialize<'de> for Die {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let sides = u8::deserialize(deserializer)?;
        Die::new(sides).map_err(de::Error::custom)
    }
}

/// One die after it has been rolled, carrying everything the UI needs to render
/// the equation without recomputing game rules.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RolledDie {
    /// Die size, so hovering a value can identify its die type (§4.3).
    pub sides: u8,
    pub value: u32,
    /// `false` for the dropped die of a four-die pool (§4.10).
    pub counted: bool,
    /// Portuguese label of where the die came from ("Físico", "Furtividade", ...).
    pub source: String,
    /// RA marker: this die holds the highest rolled value (§4.11).
    pub is_highest: bool,
    /// RB marker: this die holds the lowest rolled value (§4.11).
    pub is_lowest: bool,
}

/// Result of a resolved roll.
///
/// `rolls`, `total_sum`, `highest`, `lowest` and the critical flags are kept as
/// flat fields so existing frontend consumers keep working; `dice` carries the
/// richer per-die detail required by §4.3 and §4.11.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollResult {
    pub dice: Vec<RolledDie>,
    pub rolls: Vec<u32>,
    pub total_sum: u32,
    pub highest: u32,
    pub lowest: u32,
    /// Index into `dice` of the RA die.
    pub highest_index: usize,
    /// Index into `dice` of the RB die.
    pub lowest_index: usize,
    /// Index into `dice` of the die excluded from the total, when the pool is full.
    pub dropped_index: Option<usize>,
    pub is_critical_success: bool,
    pub is_critical_failure: bool,
    /// Portuguese description of the test, e.g. "Teste de Físico (Furtividade)".
    pub label: String,
    /// Secret rolls are only broadcast to the roller and the GM (§4.3).
    pub secret: bool,
}

/// A die queued for rolling together with its Portuguese source label.
#[derive(Debug, Clone)]
pub struct PoolEntry {
    pub die: Die,
    pub source: String,
}

impl PoolEntry {
    pub fn new(die: impl Into<Die>, source: impl Into<String>) -> Self {
        PoolEntry {
            die: die.into(),
            source: source.into(),
        }
    }
}

/// Rolls a prepared pool using the thread RNG.
pub fn roll_pool_entries(
    entries: &[PoolEntry],
    label: impl Into<String>,
    secret: bool,
) -> Result<RollResult, String> {
    let mut rng = rand::thread_rng();
    roll_pool_entries_with(&mut rng, entries, label, secret)
}

/// Rolls a prepared pool with an explicit RNG so results are reproducible in tests.
pub fn roll_pool_entries_with<R: Rng + ?Sized>(
    rng: &mut R,
    entries: &[PoolEntry],
    label: impl Into<String>,
    secret: bool,
) -> Result<RollResult, String> {
    if entries.is_empty() {
        return Err("Dice pool cannot be empty.".into());
    }
    if entries.len() > MAX_POOL_SIZE {
        return Err(format!(
            "Dice pool must contain at most {} dice, got {}.",
            MAX_POOL_SIZE,
            entries.len()
        ));
    }

    let values: Vec<u32> = entries
        .iter()
        .map(|entry| rng.gen_range(1..=entry.die.sides() as u32))
        .collect();

    let resolution = resolve_values(&values);

    let dice = entries
        .iter()
        .zip(values.iter())
        .enumerate()
        .map(|(index, (entry, &value))| RolledDie {
            sides: entry.die.sides(),
            value,
            counted: resolution.counted.contains(&index),
            source: entry.source.clone(),
            is_highest: index == resolution.highest_index,
            is_lowest: index == resolution.lowest_index,
        })
        .collect();

    Ok(RollResult {
        dice,
        rolls: values,
        total_sum: resolution.total,
        highest: resolution.highest,
        lowest: resolution.lowest,
        highest_index: resolution.highest_index,
        lowest_index: resolution.lowest_index,
        dropped_index: resolution.dropped,
        is_critical_success: resolution.is_critical_success,
        is_critical_failure: resolution.is_critical_failure,
        label: label.into(),
        secret,
    })
}

/// Everything the game rules derive from a set of rolled values, independent of
/// which dice produced them. Kept separate from the RNG so the rules can be
/// tested against exact values.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Resolution {
    /// Indices of the dice that contribute to the total.
    pub counted: Vec<usize>,
    /// Index of the die excluded from the total, when the pool is full.
    pub dropped: Option<usize>,
    pub total: u32,
    pub highest: u32,
    pub lowest: u32,
    pub highest_index: usize,
    pub lowest_index: usize,
    pub is_critical_success: bool,
    pub is_critical_failure: bool,
}

/// Applies §4.10 (highest three count), §4.11 (RA/RB) and §4.12 (criticals) to a
/// set of rolled values.
pub fn resolve_values(values: &[u32]) -> Resolution {
    assert!(!values.is_empty(), "cannot resolve an empty pool");

    // Only the highest COUNTED_DICE results contribute to the total. Sorting by
    // value descending, with the original index as tiebreaker, keeps the choice
    // deterministic when two dice share a value.
    let mut ranked: Vec<usize> = (0..values.len()).collect();
    ranked.sort_by(|&a, &b| values[b].cmp(&values[a]).then(a.cmp(&b)));
    let counted: Vec<usize> = ranked.iter().copied().take(COUNTED_DICE).collect();
    let dropped = ranked.get(COUNTED_DICE).copied();
    let total: u32 = counted.iter().map(|&i| values[i]).sum();

    // RA, RB and both criticals read every die in the pool, including one that
    // was dropped from the total.
    let highest = *values.iter().max().expect("pool is non-empty");
    let lowest = *values.iter().min().expect("pool is non-empty");
    let high_dice = values
        .iter()
        .filter(|&&v| v >= CRITICAL_SUCCESS_THRESHOLD)
        .count();

    Resolution {
        highest_index: values.iter().position(|&v| v == highest).unwrap(),
        lowest_index: values.iter().position(|&v| v == lowest).unwrap(),
        counted,
        dropped,
        total,
        highest,
        lowest,
        is_critical_success: high_dice >= CRITICAL_SUCCESS_COUNT,
        is_critical_failure: values.iter().all(|&v| v == 1),
    }
}

impl StepDice {
    /// Convenience wrapper kept for the original IPC contract: rolls a bare pool
    /// of step dice with generic source labels.
    pub fn roll_pool(dice_pool: &[StepDice]) -> Result<RollResult, String> {
        let entries: Vec<PoolEntry> = dice_pool
            .iter()
            .map(|&die| PoolEntry::new(die, die.notation()))
            .collect();
        roll_pool_entries(&entries, "Rolagem", false)
    }
}

/// Rolls an arbitrary set of dice for the free dice roller, e.g. `[20]` or `[6, 6]`.
pub fn roll_freeform(sides: &[u8], secret: bool) -> Result<RollResult, String> {
    let entries = sides
        .iter()
        .map(|&s| Die::new(s).map(|die| PoolEntry::new(die, die.notation())))
        .collect::<Result<Vec<_>, _>>()?;
    let label = entries
        .iter()
        .map(|entry| entry.die.notation())
        .collect::<Vec<_>>()
        .join(" + ");
    roll_pool_entries(&entries, label, secret)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    fn entries(sides: &[u8]) -> Vec<PoolEntry> {
        sides
            .iter()
            .map(|&s| PoolEntry::new(Die::new(s).unwrap(), format!("d{}", s)))
            .collect()
    }

    #[test]
    fn step_dice_serialize_as_plain_integers() {
        assert_eq!(serde_yaml::to_string(&StepDice::D8).unwrap().trim(), "8");
        assert_eq!(serde_json::to_string(&StepDice::D12).unwrap(), "12");
    }

    #[test]
    fn step_dice_deserialize_from_integers() {
        let die: StepDice = serde_yaml::from_str("10").unwrap();
        assert_eq!(die, StepDice::D10);
    }

    #[test]
    fn step_dice_deserialize_from_legacy_strings() {
        for raw in ["D8", "d8", "\"8\""] {
            let die: StepDice = serde_yaml::from_str(raw).unwrap();
            assert_eq!(die, StepDice::D8, "failed for {raw}");
        }
    }

    #[test]
    fn invalid_die_values_normalize_to_nearest_step() {
        // §6: "d14 / 14 must not be accepted as a valid step" and may be
        // normalized rather than crashing the application.
        let die: StepDice = serde_yaml::from_str("14").unwrap();
        assert_eq!(die, StepDice::D12);
        let die: StepDice = serde_yaml::from_str("2").unwrap();
        assert_eq!(die, StepDice::D4);
        let die: StepDice = serde_yaml::from_str("9").unwrap();
        assert_eq!(die, StepDice::D8);
        // Ties resolve downward.
        assert_eq!(StepDice::nearest(5), StepDice::D4);
        assert_eq!(StepDice::nearest(7), StepDice::D6);
    }

    #[test]
    fn steps_clamp_at_both_ends_of_the_ladder() {
        assert_eq!(StepDice::D4.apply_steps(-3), StepDice::D4);
        assert_eq!(StepDice::D12.apply_steps(5), StepDice::D12);
        assert_eq!(StepDice::D6.apply_steps(2), StepDice::D10);
        assert_eq!(StepDice::D10.apply_steps(-1), StepDice::D8);
        assert_eq!(StepDice::D8.apply_steps(0), StepDice::D8);
    }

    #[test]
    fn rolled_values_stay_within_die_bounds() {
        let mut rng = StdRng::seed_from_u64(42);
        for _ in 0..500 {
            let result =
                roll_pool_entries_with(&mut rng, &entries(&[4, 12, 20]), "teste", false).unwrap();
            assert!((1..=4).contains(&result.rolls[0]));
            assert!((1..=12).contains(&result.rolls[1]));
            assert!((1..=20).contains(&result.rolls[2]));
        }
    }

    #[test]
    fn four_die_pool_sums_only_the_highest_three() {
        let mut rng = StdRng::seed_from_u64(7);
        for _ in 0..200 {
            let result =
                roll_pool_entries_with(&mut rng, &entries(&[8, 8, 8, 8]), "teste", false).unwrap();
            let mut sorted = result.rolls.clone();
            sorted.sort_unstable_by(|a, b| b.cmp(a));
            let expected: u32 = sorted.iter().take(3).sum();
            assert_eq!(result.total_sum, expected);
            assert_eq!(result.dice.iter().filter(|d| d.counted).count(), 3);
            assert!(result.dropped_index.is_some());
        }
    }

    #[test]
    fn small_pools_count_every_die() {
        let mut rng = StdRng::seed_from_u64(11);
        let result = roll_pool_entries_with(&mut rng, &entries(&[6, 6]), "teste", false).unwrap();
        assert_eq!(result.total_sum, result.rolls.iter().sum::<u32>());
        assert!(result.dropped_index.is_none());
        assert!(result.dice.iter().all(|d| d.counted));
    }

    #[test]
    fn pool_size_is_bounded() {
        assert!(roll_pool_entries(&entries(&[]), "teste", false).is_err());
        assert!(roll_pool_entries(&entries(&[6, 6, 6, 6, 6]), "teste", false).is_err());
        assert!(roll_pool_entries(&entries(&[6]), "teste", false).is_ok());
    }

    #[test]
    fn critical_success_needs_two_dice_at_six_or_above() {
        // §4.12: "At least 2 dice roll >= 6" — the values need not match.
        let mut rng = StdRng::seed_from_u64(3);
        for _ in 0..300 {
            let result =
                roll_pool_entries_with(&mut rng, &entries(&[12, 12, 12, 12]), "teste", false)
                    .unwrap();
            let high = result.rolls.iter().filter(|&&v| v >= 6).count();
            assert_eq!(result.is_critical_success, high >= 2);
        }
    }

    #[test]
    fn the_lowest_value_is_the_one_dropped() {
        let resolution = resolve_values(&[7, 2, 9, 5]);
        assert_eq!(resolution.dropped, Some(1));
        assert_eq!(resolution.total, 7 + 9 + 5);
        assert_eq!(resolution.counted.len(), 3);
    }

    #[test]
    fn ties_are_broken_by_position_so_results_are_reproducible() {
        let resolution = resolve_values(&[4, 4, 4, 4]);
        assert_eq!(resolution.dropped, Some(3));
        assert_eq!(resolution.total, 12);
    }

    #[test]
    fn critical_detection_reads_every_die_including_the_dropped_one() {
        // Four high dice: one of them is dropped from the total, yet the tally
        // that decides the critical still sees it (§4.12).
        let resolution = resolve_values(&[6, 6, 6, 6]);
        assert_eq!(resolution.dropped, Some(3));
        assert_eq!(resolution.total, 18);
        assert!(resolution.is_critical_success);

        // A critical failure needs the dropped die to be a 1 as well.
        let resolution = resolve_values(&[1, 1, 1, 1]);
        assert!(resolution.is_critical_failure);
        assert_eq!(resolution.total, 3);
        let resolution = resolve_values(&[1, 1, 1, 2]);
        assert!(!resolution.is_critical_failure);
    }

    #[test]
    fn exactly_two_high_dice_are_enough_and_one_is_not() {
        assert!(resolve_values(&[6, 6]).is_critical_success);
        assert!(resolve_values(&[12, 6, 5, 4]).is_critical_success);
        assert!(!resolve_values(&[12, 5, 5, 4]).is_critical_success);
        assert!(!resolve_values(&[5, 5, 5]).is_critical_success);
    }

    #[test]
    fn ra_and_rb_indices_point_at_the_extreme_values() {
        let resolution = resolve_values(&[3, 11, 1, 7]);
        assert_eq!(resolution.highest_index, 1);
        assert_eq!(resolution.lowest_index, 2);
        assert_eq!(resolution.highest, 11);
        assert_eq!(resolution.lowest, 1);
    }

    #[test]
    fn critical_failure_requires_every_die_to_show_one() {
        let mut rng = StdRng::seed_from_u64(5);
        for _ in 0..2000 {
            let result =
                roll_pool_entries_with(&mut rng, &entries(&[4, 4, 4]), "teste", false).unwrap();
            assert_eq!(
                result.is_critical_failure,
                result.rolls.iter().all(|&v| v == 1)
            );
        }
    }

    #[test]
    fn ra_and_rb_mark_the_extremes_across_the_whole_pool() {
        let mut rng = StdRng::seed_from_u64(21);
        let result =
            roll_pool_entries_with(&mut rng, &entries(&[12, 12, 12, 12]), "teste", false).unwrap();
        assert_eq!(result.highest, *result.rolls.iter().max().unwrap());
        assert_eq!(result.lowest, *result.rolls.iter().min().unwrap());
        assert!(result.dice[result.highest_index].is_highest);
        assert!(result.dice[result.lowest_index].is_lowest);
        assert_eq!(result.dice.iter().filter(|d| d.is_highest).count(), 1);
    }

    #[test]
    fn freeform_roller_supports_the_d20() {
        let result = roll_freeform(&[20], false).unwrap();
        assert_eq!(result.dice[0].sides, 20);
        assert!((1..=20).contains(&result.rolls[0]));
        assert!(roll_freeform(&[7], false).is_err());
    }

    #[test]
    fn per_die_source_and_size_survive_the_roll() {
        let pool = vec![
            PoolEntry::new(StepDice::D8, "Físico"),
            PoolEntry::new(StepDice::D6, "Furtividade"),
        ];
        let result = roll_pool_entries(&pool, "Teste de Físico (Furtividade)", false).unwrap();
        assert_eq!(result.dice[0].source, "Físico");
        assert_eq!(result.dice[0].sides, 8);
        assert_eq!(result.dice[1].source, "Furtividade");
        assert_eq!(result.dice[1].sides, 6);
    }
}
