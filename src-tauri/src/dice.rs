use rand::Rng;
use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::borrow::Cow;
use std::fmt;

pub const STEP_LADDER: [u8; 5] = [4, 6, 8, 10, 12];
pub const ROLLABLE_SIDES: [u8; 6] = [4, 6, 8, 10, 12, 20];
pub const MAX_POOL_SIZE: usize = 4;
pub const COUNTED_DICE: usize = 3;

pub const CRITICAL_SUCCESS_THRESHOLD: u32 = 6;
pub const CRITICAL_SUCCESS_COUNT: usize = 2;

pub fn notation_for_sides(sides: u8) -> &'static str {
    match sides {
        4 => "d4",
        6 => "d6",
        8 => "d8",
        10 => "d10",
        12 => "d12",
        20 => "d20",
        _ => "d?",
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum StepDice {
    D4,
    D6,
    D8,
    D10,
    D12,
}

impl StepDice {
    pub const LADDER: [StepDice; 5] = [
        StepDice::D4,
        StepDice::D6,
        StepDice::D8,
        StepDice::D10,
        StepDice::D12,
    ];

    pub fn sides(self) -> u8 {
        match self {
            StepDice::D4 => 4,
            StepDice::D6 => 6,
            StepDice::D8 => 8,
            StepDice::D10 => 10,
            StepDice::D12 => 12,
        }
    }

    pub fn index(self) -> usize {
        match self {
            StepDice::D4 => 0,
            StepDice::D6 => 1,
            StepDice::D8 => 2,
            StepDice::D10 => 3,
            StepDice::D12 => 4,
        }
    }

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

    pub fn from_legacy_str(raw: &str) -> Option<Self> {
        let trimmed = raw.trim();
        let digits = trimmed.trim_start_matches(['d', 'D']);
        digits.parse::<i64>().ok().and_then(Self::from_sides)
    }

    pub fn apply_steps(self, steps: i32) -> Self {
        let target = (self.index() as i32 + steps).clamp(0, (STEP_LADDER.len() - 1) as i32);
        StepDice::LADDER[target as usize]
    }

    pub fn notation(self) -> &'static str {
        notation_for_sides(self.sides())
    }
}

impl fmt::Display for StepDice {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.notation())
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Die(u8);

impl Die {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RolledDie {
    pub sides: u8,
    pub value: u32,
    pub counted: bool,
    pub source: Cow<'static, str>,
    pub is_highest: bool,
    pub is_lowest: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollResult {
    pub dice: Vec<RolledDie>,
    pub rolls: Vec<u32>,
    pub total_sum: u32,
    pub highest: u32,
    pub lowest: u32,
    pub highest_index: usize,
    pub lowest_index: usize,
    pub dropped_index: Option<usize>,
    pub is_critical_success: bool,
    pub is_critical_failure: bool,
    pub label: String,
    pub secret: bool,
}

#[derive(Debug, Clone)]
pub struct PoolEntry {
    pub die: Die,
    pub source: Cow<'static, str>,
}

impl PoolEntry {
    pub fn new(die: impl Into<Die>, source: impl Into<Cow<'static, str>>) -> Self {
        PoolEntry {
            die: die.into(),
            source: source.into(),
        }
    }
}

pub fn roll_pool_entries(
    entries: &[PoolEntry],
    label: impl Into<String>,
    secret: bool,
) -> Result<RollResult, String> {
    let mut rng = rand::thread_rng();
    roll_pool_entries_with(&mut rng, entries, label, secret)
}

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

    let mut values: Vec<u32> = Vec::with_capacity(entries.len());
    for entry in entries {
        values.push(rng.gen_range(1..=entry.die.sides() as u32));
    }

    let resolution = resolve_values(&values);

    let mut dice: Vec<RolledDie> = Vec::with_capacity(entries.len());
    for (index, (entry, &value)) in entries.iter().zip(values.iter()).enumerate() {
        dice.push(RolledDie {
            sides: entry.die.sides(),
            value,
            counted: resolution.counted.contains(&index),
            source: entry.source.clone(),
            is_highest: index == resolution.highest_index,
            is_lowest: index == resolution.lowest_index,
        });
    }

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Resolution {
    pub counted: Vec<usize>,
    pub dropped: Option<usize>,
    pub total: u32,
    pub highest: u32,
    pub lowest: u32,
    pub highest_index: usize,
    pub lowest_index: usize,
    pub is_critical_success: bool,
    pub is_critical_failure: bool,
}

pub fn resolve_values(values: &[u32]) -> Resolution {
    assert!(!values.is_empty(), "cannot resolve an empty pool");

    let mut ranked: Vec<usize> = (0..values.len()).collect();
    ranked.sort_by(|&a, &b| values[b].cmp(&values[a]).then(a.cmp(&b)));

    let mut counted: Vec<usize> = Vec::with_capacity(COUNTED_DICE.min(ranked.len()));
    counted.extend(ranked.iter().copied().take(COUNTED_DICE));
    let dropped = ranked.get(COUNTED_DICE).copied();

    let total: u32 = counted.iter().map(|&i| values[i]).sum();

    let mut highest = values[0];
    let mut lowest = values[0];
    let mut highest_index = 0usize;
    let mut lowest_index = 0usize;
    for (index, &value) in values.iter().enumerate().skip(1) {
        if value > highest {
            highest = value;
            highest_index = index;
        }
        if value < lowest {
            lowest = value;
            lowest_index = index;
        }
    }

    let mut is_critical_success = false;
    for &v in values {
        if v >= CRITICAL_SUCCESS_THRESHOLD
            && values.iter().filter(|&&x| x == v).count() >= CRITICAL_SUCCESS_COUNT
        {
            is_critical_success = true;
            break;
        }
    }

    Resolution {
        highest_index,
        lowest_index,
        counted,
        dropped,
        total,
        highest,
        lowest,
        is_critical_success,
        is_critical_failure: values.iter().all(|&v| v == 1),
    }
}

impl StepDice {
    pub fn roll_pool(dice_pool: &[StepDice]) -> Result<RollResult, String> {
        let entries: Vec<PoolEntry> = dice_pool
            .iter()
            .map(|&die| PoolEntry::new(die, die.notation()))
            .collect();

        roll_pool_entries(&entries, "Rolagem", false)
    }
}

pub fn roll_freeform(sides: &[u8], secret: bool) -> Result<RollResult, String> {
    let mut rng = rand::thread_rng();
    if sides.is_empty() {
        return Err("Dice pool cannot be empty.".into());
    }

    let mut dice = Vec::with_capacity(sides.len());
    let mut rolls = Vec::with_capacity(sides.len());
    let mut total_sum = 0;
    let mut highest = 0;
    let mut lowest = u32::MAX;

    for &side in sides {
        if !ROLLABLE_SIDES.contains(&side) {
            return Err(format!("Unsupported die size: d{}", side));
        }
        let value = rng.gen_range(1..=side as u32);
        rolls.push(value);
        total_sum += value;
        if value > highest {
            highest = value;
        }
        if value < lowest {
            lowest = value;
        }
    }

    let highest_index = rolls.iter().position(|&v| v == highest).unwrap_or(0);
    let lowest_index = rolls.iter().position(|&v| v == lowest).unwrap_or(0);

    for (index, (&side, &value)) in sides.iter().zip(rolls.iter()).enumerate() {
        dice.push(RolledDie {
            sides: side,
            value,
            counted: true,
            source: Cow::Borrowed(notation_for_sides(side)),
            is_highest: index == highest_index,
            is_lowest: index == lowest_index,
        });
    }

    let is_critical_failure = rolls.iter().all(|&v| v == 1);
    let mut is_critical_success = false;
    for &v in &rolls {
        if v >= CRITICAL_SUCCESS_THRESHOLD
            && rolls.iter().filter(|&&x| x == v).count() >= CRITICAL_SUCCESS_COUNT
        {
            is_critical_success = true;
            break;
        }
    }

    let mut label = String::with_capacity(sides.len() * 6);
    for (index, &side) in sides.iter().enumerate() {
        if index > 0 {
            label.push_str(" + ");
        }
        label.push_str(notation_for_sides(side));
    }

    Ok(RollResult {
        dice,
        rolls,
        total_sum,
        highest,
        lowest,
        highest_index,
        lowest_index,
        dropped_index: None,
        is_critical_success,
        is_critical_failure,
        label,
        secret,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    fn entries(sides: &[u8]) -> Vec<PoolEntry> {
        sides
            .iter()
            .map(|&s| PoolEntry::new(Die::new(s).unwrap(), notation_for_sides(s)))
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
        let die: StepDice = serde_yaml::from_str("14").unwrap();
        assert_eq!(die, StepDice::D12);

        let die: StepDice = serde_yaml::from_str("2").unwrap();
        assert_eq!(die, StepDice::D4);

        let die: StepDice = serde_yaml::from_str("9").unwrap();
        assert_eq!(die, StepDice::D8);

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
    fn critical_success_needs_two_identical_dice_at_six_or_above() {
        let mut rng = StdRng::seed_from_u64(3);
        for _ in 0..300 {
            let result =
                roll_pool_entries_with(&mut rng, &entries(&[12, 12, 12, 12]), "teste", false)
                    .unwrap();

            let mut expected_crit = false;
            for &v in &result.rolls {
                if v >= 6 && result.rolls.iter().filter(|&&x| x == v).count() >= 2 {
                    expected_crit = true;
                    break;
                }
            }
            assert_eq!(result.is_critical_success, expected_crit);
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
        let resolution = resolve_values(&[6, 6, 6, 6]);
        assert_eq!(resolution.dropped, Some(3));
        assert_eq!(resolution.total, 18);
        assert!(resolution.is_critical_success);

        let resolution = resolve_values(&[1, 1, 1, 1]);
        assert!(resolution.is_critical_failure);
        assert_eq!(resolution.total, 3);

        let resolution = resolve_values(&[1, 1, 1, 2]);
        assert!(!resolution.is_critical_failure);
    }

    #[test]
    fn exactly_two_identical_high_dice_are_enough_and_one_is_not() {
        assert!(resolve_values(&[6, 6]).is_critical_success);
        assert!(resolve_values(&[12, 12, 5, 4]).is_critical_success);
        assert!(!resolve_values(&[12, 6, 5, 4]).is_critical_success);
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

    #[test]
    fn rerolling_freeform_keeps_every_die_counted() {
        let result = roll_freeform(&[6, 6, 6, 6], false).unwrap();
        let rerolled = reroll_die(result, 0).unwrap();

        assert!(rerolled.dice.iter().all(|die| die.counted));
        assert_eq!(rerolled.dropped_index, None);
        assert_eq!(rerolled.total_sum, rerolled.rolls.iter().sum::<u32>());
    }

    #[test]
    fn reroll_rejects_invalid_die_sides_instead_of_panicking() {
        let mut result = roll_freeform(&[6], false).unwrap();
        result.dice[0].sides = 0;

        assert!(reroll_die(result, 0).is_err());
    }
}

pub fn reroll_die(mut result: RollResult, index: usize) -> Result<RollResult, String> {
    if index >= result.dice.len() || index >= result.rolls.len() {
        return Err("Invalid die index.".into());
    }

    let mut rng = rand::thread_rng();
    let sides = result.dice[index].sides;
    if !ROLLABLE_SIDES.contains(&sides) {
        return Err(format!("Unsupported die size: d{}", sides));
    }

    let count_all_dice = result.dropped_index.is_none() && result.dice.iter().all(|die| die.counted);
    result.rolls[index] = rng.gen_range(1..=sides as u32);

    if count_all_dice {
        let highest = *result.rolls.iter().max().unwrap();
        let lowest = *result.rolls.iter().min().unwrap();
        let highest_index = result.rolls.iter().position(|&v| v == highest).unwrap_or(0);
        let lowest_index = result.rolls.iter().position(|&v| v == lowest).unwrap_or(0);

        for (i, die) in result.dice.iter_mut().enumerate() {
            die.value = result.rolls[i];
            die.counted = true;
            die.is_highest = i == highest_index;
            die.is_lowest = i == lowest_index;
        }

        result.total_sum = result.rolls.iter().sum();
        result.highest = highest;
        result.lowest = lowest;
        result.highest_index = highest_index;
        result.lowest_index = lowest_index;
        result.dropped_index = None;
        result.is_critical_failure = result.rolls.iter().all(|&v| v == 1);
        result.is_critical_success = result.rolls.iter().any(|&v| {
            v >= CRITICAL_SUCCESS_THRESHOLD
                && result.rolls.iter().filter(|&&x| x == v).count() >= CRITICAL_SUCCESS_COUNT
        });

        return Ok(result);
    }

    let resolution = resolve_values(&result.rolls);
    for (i, die) in result.dice.iter_mut().enumerate() {
        die.value = result.rolls[i];
        die.counted = resolution.counted.contains(&i);
        die.is_highest = i == resolution.highest_index;
        die.is_lowest = i == resolution.lowest_index;
    }

    result.total_sum = resolution.total;
    result.highest = resolution.highest;
    result.lowest = resolution.lowest;
    result.highest_index = resolution.highest_index;
    result.lowest_index = resolution.lowest_index;
    result.dropped_index = resolution.dropped;
    result.is_critical_success = resolution.is_critical_success;
    result.is_critical_failure = resolution.is_critical_failure;

    Ok(result)
}
