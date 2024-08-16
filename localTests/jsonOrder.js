function reorderJsonKeys(inputJson, order) {
    const reorderedJson = {};

    // Add keys in the specified order
    order.forEach(key => {
        if (key in inputJson) {
            reorderedJson[key] = inputJson[key];
        }
    });

    // Add any remaining keys that were not in the specified order
    Object.keys(inputJson).forEach(key => {
        if (!(key in reorderedJson)) {
            reorderedJson[key] = inputJson[key];
        }
    });

    return reorderedJson;
}


// Example usage:
const inputJson = {
    "employee_received_bonus_or_incentive_on_retrenchment": "No",
    "tenure_of_employment": "More than 240 days",
    "employer_deposited_tds_on_salary_to_government_department": "Not Aware",
    "termination_mass_layoff": "Yes",
    "employer_deposited_employer_own_pf_contribution_to_government_department": "Not Aware",
    "employee_received_gratuity_that_was_due": "Yes",
    "open_disciplinary_performance_actions": "No",
    "employee_received_3_months_notice_period_or_salary_in_lieu_of_shorter_notice_period": "No",
    "employee_received_severance_pay_for_15_days_salary_for_each_completed_service_year_on_retrenchment": "Yes",
    "employee_covered_under_esi_act": "No",
    "employee_signed_cheques_remain_uncashed": "No",
    "employee_received_all_salary_for_retrenchment": "Yes",
    "employee_received_leave_encashment_that_was_due": "Yes",
    "employer_did_gender_pay_discrimination_employee_now_wants_to_claim_differential_remuneration_law": "Not Aware",
    "nature_of_job": "Supervising other employees / contractors",
    "employee_holding_statutory_positions": "Yes",
    "employee_esop_will_miss_vesting_if_notice_period_is_not_served": "Yes",
    "employee_threatened_by_employer_to_voluntary_resign": "Yes",
    "availing_employee_health_insurance_for_self_and_family": "Yes",
    "working_outside_working_hours_and_weekends_and_wants_overtime": "No",
    "time_spending_in_team_supervising": "More than 75% time",
    "employee_recently_asked_to_move_to_different_city_for_work_and_want_to_claim_cost_of_relocation": "Yes",
    "informed_employer_of_health_status": " No",
    "employee_is_person_with_disability_and_unfairly_terminated": "No",
    "nature_of_employment": "Permanent",
    "employee_is_transgender_and_unfairly_terminated": "No",
    "employee_named_as_complainant_or_witness_for_employer_legal_matters": "Yes",
    "employee_already_filed_complaint_regarding": "No complaint filed",
    "employee_paid_enhanced_insurance_from_salary": "No",
    "employer_deposited_employee_pf_contribution_to_government_department": "Not Aware",
    "workplace_injury_in_past_still_subsisting": "No",
    "employee_made_to_forego_accumulated_leaves_now_claims_compensation": "Yes",
    "woman_employee_seeks_compensation_for_employer_discriminating_women_employee_on_condition_of_service": "Not Aware",
    "employee_claims_full_vesting_of_esop_due_to_unfair_termination": "Yes",
    "employee_is_sufferring_with_hiv_or_aids_and_unfairly_terminated": "No",
    "employee_received_notice_pay_for_retrenchment": "No",
    "employee_belongs_to_schedule_cast_or_schedule_tribe_and_unfairly_terminated": "No",
    "option_for_compliant": "Notice To The Company"
};

const result = reorderJsonKeys(inputJson);
console.log(result);
