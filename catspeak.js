// Salvia's speech bubbles in more than one language: six times in ten she speaks English,
// otherwise one of Arabic, Spanish, Malayalam, French or Urdu, picked at random, in its own
// script. Lines without an entry here (sounds like '!', 'mrrp', 'z z z') stay as they are.

const LANGS = ['ar', 'es', 'ml', 'fr', 'ur'];
const NOM = { ar: '*هم هم*', es: '*ñam ñam*', ml: '*കറുമുറ*', fr: '*miam miam*', ur: '*چپڑ چپڑ*' };

export const LINES = {
  // her own sounds
  'choose your station': { ar: 'اختر محطتك', es: 'elige tu emisora', ml: 'നിന്റെ സ്റ്റേഷൻ തിരഞ്ഞെടുക്കൂ', fr: 'choisis ta station', ur: 'اپنا اسٹیشن چنو' },
  'choose your weather': { ar: 'اختر طقسك', es: 'elige tu clima', ml: 'നിന്റെ കാലാവസ്ഥ തിരഞ്ഞെടുക്കൂ', fr: 'choisis ta météo', ur: 'اپنا موسم چنو' },
  'meow': { ar: 'مياو', es: 'miau', ml: 'മ്യാവൂ', fr: 'miaou', ur: 'میاؤں' },
  'prrrr ♥': { ar: 'خرررر ♥', es: 'rrrrr ♥', ml: 'ർർർർ ♥', fr: 'ronron ♥', ur: 'خرّر ♥' },
  'prrrrrrr': { ar: 'خرررررر', es: 'rrrrrrr', ml: 'ർർർർർർ', fr: 'ronronron', ur: 'خرّرّر' },
  '*loves you*': { ar: 'يا عمري ♥', es: 'te quiero, miau ♥', ml: 'ഇഷ്ടം ♥', fr: "je t'aime, miaou ♥", ur: 'جانو ♥' },
  // arriving, leaving, checking in
  '*appears*': { ar: '*تظهر*', es: '*aparece*', ml: '*പ്രത്യക്ഷപ്പെടുന്നു*', fr: '*apparaît*', ur: '*نمودار ہوتی ہے*' },
  '*pads in*': { ar: '*تدخل بخطوات ناعمة*', es: '*entra sin hacer ruido*', ml: '*പതുക്കെ നടന്നുവരുന്നു*', fr: '*entre à pas de velours*', ur: '*دبے پاؤں آتی ہے*' },
  '*checks in*': { ar: '*تطمئن عليك*', es: '*viene a ver cómo estás*', ml: '*സുഖമാണോ എന്ന് നോക്കാൻ വരുന്നു*', fr: '*vient voir si ça va*', ur: '*حال پوچھنے آتی ہے*' },
  '*loaf mode*': { ar: '*وضعية الرغيف*', es: '*modo pan*', ml: '*അപ്പം പോലെ ഇരിക്കുന്നു*', fr: '*mode brioche*', ur: '*روٹی بن کر بیٹھی ہے*' },
  '*pretends not to care*': { ar: '*تتظاهر بعدم الاهتمام*', es: '*finge que no le importa*', ml: '*ശ്രദ്ധിക്കാത്ത പോലെ ഭാവിക്കുന്നു*', fr: "*fait semblant de s'en moquer*", ur: '*ایسے ظاہر کرتی ہے جیسے پروا نہیں*' },
  '*sits on your song*': { ar: '*تجلس على أغنيتك*', es: '*se sienta sobre tu canción*', ml: '*നിന്റെ പാട്ടിന്മേൽ ഇരിക്കുന്നു*', fr: "*s'assoit sur ta chanson*", ur: '*تمہارے گانے پر بیٹھ جاتی ہے*' },
  '*wanders off, satisfied*': { ar: '*تبتعد راضية*', es: '*se va, satisfecha*', ml: '*തൃപ്തിയോടെ നടന്നുപോകുന്നു*', fr: "*s'éloigne, satisfaite*", ur: '*مطمئن ہو کر چل دیتی ہے*' },
  // play
  '*wiggles*': { ar: '*تتمايل*', es: '*menea el trasero*', ml: '*ആടിക്കളിക്കുന്നു*', fr: '*se trémousse*', ur: '*مٹکتی ہے*' },
  '*pounces at nothing*': { ar: '*تنقضّ على لا شيء*', es: '*salta sobre nada*', ml: '*വെറുതെ ചാടിവീഴുന്നു*', fr: '*bondit sur rien*', ur: '*ہوا پر جھپٹتی ہے*' },
  '*zoomies*': { ar: '*تركض كالمجنونة*', es: '*corre como loca*', ml: '*പാഞ്ഞോടുന്നു*', fr: '*fait la folle*', ur: '*پاگلوں کی طرح دوڑتی ہے*' },
  '*chirps at a fly*': { ar: '*تزقزق لذبابة*', es: '*le hace gorjeos a una mosca*', ml: '*ഈച്ചയെ നോക്കി ചിലയ്ക്കുന്നു*', fr: '*fait des petits cris à une mouche*', ur: '*مکھی کو دیکھ کر چہچہاتی ہے*' },
  // under water
  '*watches a koi*': { ar: '*تراقب سمكة كوي*', es: '*mira un koi*', ml: '*ഒരു കോയി മീനിനെ നോക്കുന്നു*', fr: '*observe une carpe koï*', ur: '*مچھلی کو تکتی ہے*' },
  '*eyes a koi*': { ar: '*تحدّق في سمكة*', es: '*le echa el ojo a un koi*', ml: '*കോയിയിൽ കണ്ണുവെക്കുന്നു*', fr: '*lorgne une koï*', ur: '*مچھلی کو گھورتی ہے*' },
  '…fish.': { ar: '…سمك.', es: '…pez.', ml: '…മീൻ.', fr: '…poisson.', ur: '…مچھلی.' },
  '*bats at a koi*': { ar: '*تضرب سمكة بمخلبها*', es: '*le da un zarpazo a un koi*', ml: '*കോയിയെ കൈകൊണ്ട് തട്ടുന്നു*', fr: '*donne un coup de patte à une koï*', ur: '*مچھلی کو پنجہ مارتی ہے*' },
  // the corner, the Theyyam
  '*curls up by it*': { ar: '*تتكوّر بجانبه*', es: '*se acurruca a su lado*', ml: '*അതിനരികിൽ ചുരുണ്ടുകൂടുന്നു*', fr: '*se roule en boule à côté*', ur: '*اس کے پاس گول ہو کر لیٹ جاتی ہے*' },
  '*sniff sniff*': { ar: '*شمّ شمّ*', es: '*snif snif*', ml: '*മണം പിടിക്കുന്നു*', fr: '*snif snif*', ur: '*سونگھ سونگھ*' },
  '*keeps an eye on it*': { ar: '*تراقبه بحذر*', es: '*no le quita el ojo*', ml: '*അതിനെ ശ്രദ്ധിച്ചിരിക്കുന്നു*', fr: "*le garde à l'œil*", ur: '*اس پر نظر رکھتی ہے*' },
  '*bolts*': { ar: '*تهرب مسرعة*', es: '*sale disparada*', ml: '*ഓടിമറയുന്നു*', fr: '*détale*', ur: '*بھاگ کھڑی ہوتی ہے*' },
  // waking, eating
  '*stretches*': { ar: '*تتمطّى*', es: '*se estira*', ml: '*മൂരി നിവർക്കുന്നു*', fr: "*s'étire*", ur: '*انگڑائی لیتی ہے*' },
  '*licks paw*': { ar: '*تلعق كفّها*', es: '*se lame la pata*', ml: '*കൈ നക്കുന്നു*', fr: '*se lèche la patte*', ur: '*پنجہ چاٹتی ہے*' },
  '*burp*': { ar: '*تتجشّأ*', es: '*¡burp!*', ml: '*ഏമ്പക്കം*', fr: '*rot*', ur: '*ڈکار*' },
  '*washes face*': { ar: '*تغسل وجهها*', es: '*se lava la cara*', ml: '*മുഖം കഴുകുന്നു*', fr: '*fait sa toilette*', ur: '*منہ دھوتی ہے*' },
  '*satisfied*': { ar: '*راضية*', es: '*satisfecha*', ml: '*തൃപ്തി*', fr: '*satisfaite*', ur: '*مطمئن*' },
  '*chomp*': NOM, '*crunch*': NOM, '*munch*': NOM, '*chomp chomp*': NOM,
  '*all gone*': { ar: '*خلص!*', es: '*¡se acabó!*', ml: '*തീർന്നു!*', fr: '*plus rien !*', ur: '*ختم!*' },
  // with you
  '*headbutt*': { ar: '*تنطحك بلطف*', es: '*cabezazo cariñoso*', ml: '*തലകൊണ്ട് ഉരസുന്നു*', fr: '*coup de tête tout doux*', ur: '*سر سے ٹکر مارتی ہے*' },
  '*slow blink*': { ar: '*ترمش ببطء*', es: '*parpadeo lento*', ml: '*പതുക്കെ കണ്ണുചിമ്മുന്നു*', fr: '*clignement lent*', ur: '*آہستہ سے پلک جھپکتی ہے*' },
  '*rubs on you*': { ar: '*تتمسّح بك*', es: '*se frota contigo*', ml: '*നിന്നോട് ഉരുമ്മുന്നു*', fr: '*se frotte contre toi*', ur: '*تم سے لپٹتی ہے*' },
  '*kneads the counter*': { ar: '*تعجن المكان بكفّيها*', es: '*amasa la encimera*', ml: '*കൈകൊണ്ട് കുഴയ്ക്കുന്നു*', fr: '*pétrit le plan de travail*', ur: '*پنجوں سے آٹا گوندھتی ہے*' },
  '*kneads the mattress*': { ar: '*تعجن الفرشة بكفّيها*', es: '*amasa el colchón*', ml: '*മെത്തയിൽ കുഴയ്ക്കുന്നു*', fr: '*pétrit le matelas*', ur: '*گدّے پر آٹا گوندھتی ہے*' },
  '*toe beans*': { ar: '*وسائد كفوفها الصغيرة*', es: '*almohadillas*', ml: '*കുഞ്ഞു പാദങ്ങൾ*', fr: '*coussinets*', ur: '*ننھے پنجے*' },
  '*tail up, happy*': { ar: '*ذيلها مرفوع، سعيدة*', es: '*cola arriba, feliz*', ml: '*വാൽ പൊക്കി, സന്തോഷം*', fr: '*queue en l\'air, contente*', ur: '*دم اونچی، خوش*' },
};

export function speak(text) {
  const line = LINES[text];
  if (!line || Math.random() < 0.6) return text;
  return line[LANGS[Math.floor(Math.random() * LANGS.length)]] ?? text;
}
