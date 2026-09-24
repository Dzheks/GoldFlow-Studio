export interface DirectorNineFields {
  lens: string;         // ОБЪЕКТИВ (Широкий 28 мм, низкая точка)
  action: string;       // ДЕЙСТВИЕ (Пробивает бетон домкратом)
  moment: string;       // МОМЕНТ (За секунду до того, как стена подалась)
  foreground: string;   // ПЕРЕДНИЙ ПЛАН (Осколки и пыль в луче фонаря)
  location: string;     // МЕСТО (Тоннель под хранилищем банка)
  background: string;   // ФОН (Темнота, уходящая вглубь коллектора)
  texture: string;      // ФАКТУРА (Мокрый бетон, ржавое железо)
  light: string;        // СВЕТ (Один фонарь сбоку, резкие тени)
  mood: string;         // НАСТРОЕНИЕ (Напряжение, работа на пределе)
}

export const DEFAULT_NINE_FIELDS: DirectorNineFields = {
  lens: 'Широкий 28 мм, низкая точка',
  action: 'Пробивает бетон домкратом',
  moment: 'За секунду до того, как стена подалась',
  foreground: 'Осколки и пыль в луче фонаря',
  location: 'Тоннель под хранилищем банка',
  background: 'Темнота, уходящая вглубь коллектора',
  texture: 'Мокрый бетон, ржавое железо',
  light: 'Один фонарь сбоку, резкие тени',
  mood: 'Напряжение, работа на пределе',
};

// Field labels are kept in English on purpose — this compiles straight into the
// image-generation prompt (Nano Banana etc.), and mixing Russian labels with
// English field content confuses image models more than it helps readability.
export function compileNineFieldsPrompt(fields: DirectorNineFields, heroReference?: string): string {
  const parts = [
    fields.location ? `Location: ${fields.location}` : '',
    fields.action ? `Action: ${fields.action}` : '',
    fields.moment ? `Moment: ${fields.moment}` : '',
    fields.lens ? `Camera/lens: ${fields.lens}` : '',
    fields.foreground ? `Foreground: ${fields.foreground}` : '',
    fields.background ? `Background: ${fields.background}` : '',
    fields.light ? `Lighting: ${fields.light}` : '',
    fields.texture ? `Texture: ${fields.texture}` : '',
    fields.mood ? `Mood: ${fields.mood}` : '',
    heroReference ? `[HERO REFERENCE: face and appearance must strictly match the reference image]` : ''
  ].filter(Boolean);

  return parts.join('. ');
}
