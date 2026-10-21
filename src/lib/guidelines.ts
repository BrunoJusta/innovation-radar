/**
 * Secção das guidelines sobre os três resultados da análise (Invest, Uncertain, Do not invest).
 * Fica no texto das guidelines (Definições › Critérios de investimento), em inglês como o resto do documento.
 */
export const SECCAO_DECISAO = `Investment decision outcomes (applicable to all tickets)

Each assessment ends with one of three decisions:

• INVEST: strong strategic fit AND enough evidence (team, traction, round terms, wine use case) to support the proposed ticket. Conditions may still apply (standard due diligence, pilot), but they confirm what the evidence already supports.

• UNCERTAIN: the startup is interesting and has a clear strategic fit, but decisive information is missing to reach a decision, typically financial data (round size, valuation, revenue or funding history with no data available) or wine-specific evidence. An uncertain decision must state exactly what is missing and how to obtain it (e.g., request the deck and round terms, run a pilot). It should not be presented as "Invest, conditional on DD and pilot" when the missing element is the evidence itself.
Example: an adjacency that matches one of Sogrape's 2026 investment/pilot priorities (strong strategic logic), but without enough financial and wine-specific evidence to justify a medium or large ticket, is UNCERTAIN, not INVEST.

• DO NOT INVEST: fails the mandatory criteria for the ticket or lacks strategic fit, even if more data were available.

An uncertain opportunity stays in the pipeline until the missing information is received, and is then re-assessed.`;

/** As guidelines já têm a secção? */
export const temSeccaoDecisao = (t: string) => /investment decision outcomes/i.test(t) || /\bUNCERTAIN\b/.test(t);
