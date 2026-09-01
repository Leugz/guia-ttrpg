use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepDice {
    D4 = 4,
    D6 = 6,
    D8 = 8,
    D10 = 10,
    D12 = 12,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RollResult {
    pub rolls: Vec<u32>,
    pub total_sum: u32,
    pub highest: u32,
    pub lowest: u32,
    pub is_critical_success: bool,
    pub is_critical_failure: bool,
}

impl StepDice {
    /// Steps the dice up or down by a given modifier, hard-clamping at D4 and D12.
    pub fn apply_modifier(self, steps: i32) -> Self {
        let sequence = [
            StepDice::D4,
            StepDice::D6,
            StepDice::D8,
            StepDice::D10,
            StepDice::D12,
        ];
        
        let current_index = sequence.iter().position(|&d| d == self).unwrap() as i32;
        let new_index = (current_index + steps).clamp(0, 4) as usize;
        
        sequence[new_index]
    }

    /// Executes a roll for a pool of 2 to 4 dice, handling drop-lowest, RA/RB tracking, and critical states.
    pub fn roll_pool(dice_pool: &[StepDice]) -> Result<RollResult, String> {
        if dice_pool.len() < 2 || dice_pool.len() > 4 {
            return Err("Dice pool must contain between 2 and 4 dice.".into());
        }

        let mut rng = rand::thread_rng();
        let rolls: Vec<u32> = dice_pool
            .iter()
            .map(|&die| {
                let max = die as u32;
                rng.gen_range(1..=max)
            })
            .collect();

        // RA (Highest) and RB (Lowest) track across ALL rolled dice in the pool
        let highest = *rolls.iter().max().unwrap();
        let lowest = *rolls.iter().min().unwrap();

        // Summation logic: If rolling 4 dice, drop the lowest and sum the remaining 3
        let mut sum_pool = rolls.clone();
        if sum_pool.len() == 4 {
            sum_pool.sort_unstable();
            sum_pool.remove(0); // Drops the lowest die from calculation
        }
        let total_sum: u32 = sum_pool.iter().sum();

        // Critical Success: At least 2 dice share the same value where value >= 6
        let mut is_critical_success = false;
        let mut value_counts = std::collections::HashMap::new();
        for &r in &rolls {
            if r >= 6 {
                *value_counts.entry(r).or_insert(0) += 1;
            }
        }
        for &count in value_counts.values() {
            if count >= 2 {
                is_critical_success = true;
                break;
            }
        }

        // Critical Failure: All dice in the pool roll a 1
        let is_critical_failure = rolls.iter().all(|&r| r == 1);

        Ok(RollResult {
            rolls,
            total_sum,
            highest,
            lowest,
            is_critical_success,
            is_critical_failure,
        })
    }
}
