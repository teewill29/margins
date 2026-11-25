// Words people sing differently from how the `syllable` package counts them. Overrides win.
export const SYLLABLE_OVERRIDES: Readonly<Record<string, number>> = {
  fire: 1,
  hour: 1,
  every: 2,
  family: 2,
  different: 2,
  evening: 2,
  chocolate: 2,
  our: 1,
  flower: 2,
  heaven: 2,
  // The package counts these as 3 (it hears the e in "nine").
  nineteen: 2,
  ninety: 2,
};
