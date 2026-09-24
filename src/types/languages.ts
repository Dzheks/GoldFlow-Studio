export interface ProjectLanguage {
  id: string;
  name: string;
  nativeName: string;
  sampleScript: string;
  sampleCaption: string;
  fontFamily?: string;
  direction?: 'ltr' | 'rtl';
}

export const ELEVEN_LANGUAGES: ProjectLanguage[] = [
  {
    id: 'ru',
    name: 'Русский',
    nativeName: 'Русский',
    sampleScript: 'Бизнесы с максимальной отдачей на квадратный метр часто выглядят так, будто не зарабатывают вовсе.',
    sampleCaption: '1984 год. Ницца, Франция',
    direction: 'ltr',
  },
  {
    id: 'en',
    name: 'English',
    nativeName: 'English',
    sampleScript: 'The highest-return businesses per square foot often look like they make nothing at all.',
    sampleCaption: '1984. Nice, France',
    direction: 'ltr',
  },
  {
    id: 'es',
    name: 'Español',
    nativeName: 'Español',
    sampleScript: 'Los negocios con mayor rentabilidad por metro cuadrado a menudo parecen no generar nada en absoluto.',
    sampleCaption: 'Año 1984. Niza, Francia',
    direction: 'ltr',
  },
  {
    id: 'de',
    name: 'Deutsch',
    nativeName: 'Deutsch',
    sampleScript: 'Unternehmen mit der höchsten Rendite pro Quadratmeter sehen oft so aus, als würden sie gar nichts verdienen.',
    sampleCaption: 'Jahr 1984. Nizza, Frankreich',
    direction: 'ltr',
  },
  {
    id: 'fr',
    name: 'Français',
    nativeName: 'Français',
    sampleScript: 'Les commerces au rendement le plus élevé au mètre carré semblent souvent ne rien rapporter du tout.',
    sampleCaption: 'Année 1984. Nice, France',
    direction: 'ltr',
  },
  {
    id: 'pt',
    name: 'Português',
    nativeName: 'Português',
    sampleScript: 'Os negócios com maior retorno por metro quadrado costumam parecer que não faturam quase nada.',
    sampleCaption: 'Ano de 1984. Nice, França',
    direction: 'ltr',
  },
  {
    id: 'pl',
    name: 'Polski',
    nativeName: 'Polski',
    sampleScript: 'Biznesy o najwyższym zwrocie z metra kwadratowego często wyglądają tak, jakby w ogóle nie zarabiały.',
    sampleCaption: 'Rok 1984. Nicea, Francja',
    direction: 'ltr',
  },
  {
    id: 'tr',
    name: 'Türkçe',
    nativeName: 'Türkçe',
    sampleScript: 'Metrekare başına en yüksek getirisi olan işletmeler genellikle hiç kazanmıyormuş gibi görünür.',
    sampleCaption: '1984 yılı. Nice, Fransa',
    direction: 'ltr',
  },
  {
    id: 'ar',
    name: 'العربية',
    nativeName: 'العربية',
    sampleScript: 'غالباً ما تبدو الشركات ذات العائد الأعلى لكل متر مربع وكأنها لا تكسب أي شيء على الإطلاق.',
    sampleCaption: 'عام 1984. نيس، فرنسا',
    direction: 'rtl',
  },
  {
    id: 'hi',
    name: 'हिन्दी',
    nativeName: 'हिन्दी',
    sampleScript: 'प्रति वर्ग मीटर सबसे अधिक लाभ देने वाले व्यवसाय अक्सर ऐसे दिखते हैं जैसे वे कुछ भी नहीं कमाते।',
    sampleCaption: 'वर्ष 1984. नीस, फ़्रांस',
    direction: 'ltr',
  },
  {
    id: 'zh',
    name: '中文',
    nativeName: '中文',
    sampleScript: '每平方米回报率最高的商业通常看起来根本不赚钱。',
    sampleCaption: '1984年 法国尼斯',
    direction: 'ltr',
  },
];
