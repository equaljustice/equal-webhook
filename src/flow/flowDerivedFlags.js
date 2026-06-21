/**
 * Cross-answer derived flags for emp_termination (and similar legal flows).
 * Recomputed after every answer so routers can express multi-field rules.
 */
const MANAGER_AUTH_KEYS = [
  "manager_authority_hire",
  "manager_authority_budget",
  "manager_authority_represent",
  "manager_time_managerial",
];

export function computeDerivedFlags(answers = {}) {
  const emp = answers.nature_of_employment;
  const probationReason = answers.probation_termination_reason;
  const contractRenewed = answers.contract_regularly_renewed;

  const eligiblePermanentLike =
    emp === "permanent" ||
    (emp === "probation" && probationReason !== "mass_layoff") ||
    (emp === "contractual" && contractRenewed === "yes");

  const tenure = answers.tenure_of_employment;
  const tenureOver240 =
    tenure === "between_240_days_and_4_years" ||
    tenure === "more_than_4_years_240_days";
  const tenureOver4y240d = tenure === "more_than_4_years_240_days";
  const tenureUnder4y240d = tenure !== "more_than_4_years_240_days";

  const job = answers.nature_of_job;
  const managerAllNo =
    job === "manager" &&
    MANAGER_AUTH_KEYS.every((k) => answers[k] === "no");
  const managerAnyYes =
    job === "manager" &&
    MANAGER_AUTH_KEYS.some((k) => answers[k] === "yes");

  const isWorkmanForLifo =
    job === "individual_contributor" ||
    job === "manual_unskilled" ||
    (job === "manager" && managerAllNo);

  const isAdminManagerSupervisor =
    job === "administrative" || (job === "manager" && managerAnyYes);

  const noticeUnder3Months =
    answers.d_notice_period === "1_month" ||
    answers.d_notice_period === "2_month" ||
    answers.d_notice_period === "others";

  return {
    eligiblePermanentLike,
    tenureOver240,
    tenureOver4y240d,
    tenureUnder4y240d,
    isWorkmanForLifo,
    isAdminManagerSupervisor,
    managerAllNo,
    managerAnyYes,
    noticeUnder3Months,
  };
}

export function refreshDerivedFlags(session) {
  session.flowFlags = computeDerivedFlags(session.answers || {});
  return session.flowFlags;
}
