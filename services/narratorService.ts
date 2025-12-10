
// Static narrator service without AI dependency
const NARRATIONS = {
  start: [
    "המסע מתחיל! הבה נצוד!",
    "השבט רעב, אל תאכזב!",
    "הרוחות איתך, אוג!",
    "ממותה גדולה מחכה...",
  ],
  victory: [
    "הממותה נפלה! בשר לכולם!",
    "אתה הגיבור של השבט!",
    "האגדה שלך תסופר לדורי דורות!",
    "ניצחון אדיר!",
  ],
  defeat: [
    "החושך יורד...",
    "החיות ניצחו הפעם.",
    "נסה שוב, הצייד הגדול.",
    "הנבוט נשבר...",
  ],
  powerup: [
    "כוח של נמר!",
    "מהירות הרוח!",
    "השרירים מתנפחים!",
    "אנרגיה קדומה!",
  ],
  parry: [
    "חסמת!",
    "לא היום!",
    "הגנה מושלמת!",
    "בום! חסימה!",
  ],
  score: [
    "אוצר לשבט!",
    "הניקוד עולה!",
    "כבוד גדול!",
  ],
  default: [
    "הסכנה אורבת...",
    "המשך בדרך...",
  ]
};

export const generateNarration = async (event: string): Promise<string> => {
  // Simulate network delay for realism
  await new Promise(resolve => setTimeout(resolve, 200));

  let category: keyof typeof NARRATIONS = 'default';

  if (event.includes("ניצח")) category = 'victory';
  else if (event.includes("נרמס") || event.includes("Game Over")) category = 'defeat';
  else if (event.includes("ברק") || event.includes("בשר")) category = 'powerup';
  else if (event.includes("חסימה")) category = 'parry';
  else if (event.includes("אוצר") || event.includes("ניקוד")) category = 'score';
  else if (event.includes("מתחיל") || event.includes("Start")) category = 'start';

  const options = NARRATIONS[category];
  return options[Math.floor(Math.random() * options.length)];
};
