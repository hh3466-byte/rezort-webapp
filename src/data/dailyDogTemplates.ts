/**
 * מאגר 100 הנוסחים המעודכנים להודעה יומית (20:00) מנקודת מבטו של הכלב
 * 
 * סוגי הודעות:
 * - safe: מתאים לכל הכלבים (כולל בידוד). מדגיש טיול בטבע, ניהול שמוליק, אוכל גורמה, מנוחה.
 * - friendly: לחברותיים בלבד (מדשאת משחקים, חברים על 4). לעולם לא נשלח לכלב בבידוד/תוקפני!
 * - isolation: מותאם אישית לכלבים בבידוד / תוקפניים (יחס אישי 1-על-1, טיול פרטי בטבע, שקט, ללא אזכור של כלבים אחרים או מדשאה).
 */

export interface DailyDogTemplate {
  id: number;
  type: 'safe' | 'friendly' | 'isolation' | 'training';
  category: 'nature' | 'boss_dog' | 'gourmet_meal' | 'sweet_longing' | 'lawn' | 'isolation_vip' | 'training_progress';
  text: string;
}

export const DAILY_DOG_TEMPLATES: DailyDogTemplate[] = [
  // קבוצה 1: טיול יומי בטבע, הרפתקאות וריחות (1–20)
  {
    id: 1,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 סיימתי עכשיו טיול יומי בטבע של אלופים אמיתיים! 🌲🌿 ריחרחתי כל עץ ושיח, ועכשיו אני שוכב רגוע ומרוצה בסוויטה שלי 🛋️✨ תיהנו בעניינים שלכם, אוהב {dogName} 🐶❤️'
  },
  {
    id: 2,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 בזמן שאתם בעניינים שלכם, אני חרשתי היום את השבילים בטיול טבע משגע! 🌲🐾 שמוליק ניסה לעמוד בקצב המלכותי שלי... תבלו בכיף, {dogName} 🐕👑🌿'
  },
  {
    id: 3,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 רק רציתי לעדכן שהטבע פה פשוט וואוו! 🌲✨ חזרתי מהטיול היומי עמוס בחוויות וריחות חדשים, ועכשיו אני נח כמו מלך אמיתי 👑🛋️ נשיקות מ-{dogName} 🐶💋'
  },
  {
    id: 4,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 הודעתי לשמוליק ששעת היציאה לטבע הגיעה, והוא מיד התייצב ללוות אותי למסלול מהמם! 🌲🐕 היה מושלם ואני הכי בסבבה בעולם! {dogName} 🐶👑🌾'
  },
  {
    id: 5,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 נשמתי היום אוויר צלול בטיול בטבע, חקרתי שבילים חדשים ועכשיו הראש שלי שקוע עמוק בכרית 🌲😴 תיהנו איפה שאתם, הכל דבש! {dogName} 🐕🍃✨'
  },
  {
    id: 6,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 עשיתי היום צעידה של אלופים בטיול בטבע, ועכשיו אני מתכנן שנת יופי ארוכה ומלכותית 🌲💤👑 תמשיכו לבלות בראש שקט לגמרי, {dogName} 🐶✨'
  },
  {
    id: 7,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 הטיול היומי בטבע היה כזה מושלם, שממש מגיע לכם להמשיך לבלות בלי שום דאגות! 🌲🐾 הכל פה 10 מתוך 10! אוהב המון, {dogName} 🐕⭐❤️'
  },
  {
    id: 8,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 המרחבים בטיול הטבע פשוט פתחו לי את הנשמה! 🌲🌿 עכשיו אני שוכב מרוצה על הגב ומחכה למנת הליטופים של הערב 💆‍♂️ תעשו חיים, {dogName} 🐶✨'
  },
  {
    id: 9,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 בזמן שאתם בפקקים או בסידורים, אני טיילתי בטבע כמו שייח\' אמיתי עם פמליה צמודה! 🌲👑 תיהנו בכיף שלכם, {dogName} 🐕🕶️✨'
  },
  {
    id: 10,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 בדקתי היום בטיול בטבע כל אבן, ענף ועלה, ואישרתי שהאיכות מעולה! 🌲🔍 סמכו עליי, אני בשיא שלי! ד״ש מ-{dogName} 🐶👑🌾'
  },
  {
    id: 11,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 מעדכן ישירות מהשטח: הטיול בטבע היה הצלחה מסחררת, והשנ״צ שאחריו שובר שיאים! 🌲😴💤 תבלו בלי חשבון, {dogName} 🐕✨'
  },
  {
    id: 12,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 איזה כיף לחלץ עצמות במרחבים הפתוחים של הטבע! 🌲🐾 אל תרגישו אשמים אפילו לרגע – אני עושה פה חיים משוגעים! {dogName} 🐶🥳✨'
  },
  {
    id: 13,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 אם יש משהו שאני הכי אוהב זה טיול טוב בטבע ומיטה סופר מפנקת בסופו 🌲🛋️ יש פה את שניהם ברמת 5 כוכבים! ערב מעולה, {dogName} 🐕⭐🤍'
  },
  {
    id: 14,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 שמוליק לקח אותי היום למסלול טבע לפנתיאון! 🌲🌿 חזרתי עם חיוך מאוזן לאוזן וזנב שלא מפסיק לכשכש 😄🐾 תיהנו שם, {dogName} 🐶❤️'
  },
  {
    id: 15,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 החיים בטבע עשו לי רק טוב – שקט, שלווה ונופים מדהימים 🌲🌄 תמשיכו בעיסוקים שלכם בנחת, הכל פה תחת שליטה! {dogName} 🐕🍃✨'
  },
  {
    id: 16,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 אחרי טיול חלומי בטבע, הבנתי ששנינו בחופשה מושלמת במקביל! 🌲✈️ תעשו חיים, אני מסודר מכף רגל ועד זנב! {dogName} 🐶👑💖'
  },
  {
    id: 17,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 שרפתי קלוריות בטיול בטבע, ועכשיו אני שוכב רפוי ומאושר כמו שטיח פרסי יוקרתי בסוויטה 🌲🛋️ שיהיה לכם ערב פגז, {dogName} 🐕👑✨'
  },
  {
    id: 18,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 הטבע פה מסביב פשוט משגע! 🌲🍃 שמוליק והצוות דואגים שלא יחסר למלכות שלי אפילו גרגר פינוק אחד 👑 תבלו בכיף, {dogName} 🐶❤️'
  },
  {
    id: 19,
    type: 'safe',
    category: 'nature',
    text: 'היי {ownerName}! 🐾 הזנב שלי כישכש בלי הפסקה לאורך כל הטיול בטבע, ועכשיו הוא במצב מנוחה 🌲🐾 אל תדאגו לי לשנייה – הכל מושלם! אוהב, {dogName} 🐕✨🥰'
  },
  {
    id: 20,
    type: 'safe',
    category: 'nature',
    text: 'ערב טוב {ownerName}! 🐾 חזרתי מהטיול היומי בטבע, שתיתי מים צוננים מקערה נקייה ונכנסתי למוד פינוק לילי 🌲🥣💤 תיהנו בעניינים שלכם ברוגע! {dogName} 🐶🤍'
  },

  // קבוצה 2: הכלב הוא המלך ושמוליק עובד אצלי (21–40)
  {
    id: 21,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 שמעתי שאתם עובדים קשה... אל תשכחו שמישהו צריך לממן למלך שלו את הריזורט המפנק הזה! 👑💳 תמשיכו לעבוד, אני נח פה! {dogName} 🐶😎✨'
  },
  {
    id: 22,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 שמוליק חשב לרגע שהוא המנהל פה, עד שנתתי לו מבט של מי באמת קובע את הלו״ז בריזורט 👑 הכל תחת שליטה מלאה שלי! {dogName} 🐶👑✨'
  },
  {
    id: 23,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 הדרכתי היום את שמוליק בדיוק איך אני אוהב את הכרית שלי תפוחה ואת הליטוף בסנטר 🛋️ הוא לומד מהר, יש לו פוטנציאל! {dogName} 🐕👑🎓'
  },
  {
    id: 24,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 העברתי לשמוליק רשימת דרישות למחר: טיול טבע מוקדם, פינוק VIP ואפס הפרעות לשנ״צ 🌲📋 הוא רשם הכל בדייקנות! תבלו, {dogName} 🐶👑✨'
  },
  {
    id: 25,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 נתתי לשמוליק ציון 10 מתוך 10 על שירות החדרים היום 🛎️ הוא מתאמץ מאוד לרצות את הוד מלכותי! תמשיכו בעניינים שלכם, {dogName} 🐕👑⭐'
  },
  {
    id: 26,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 שמוליק קרא לי \'חמוד\', אז הזכרתי לו בנימוס שהתואר הרשמי שלי הוא \'הוד מעלתו\' 👑 המשרתים פה ממש בסדר! נשיקות, {dogName} 🐶👑🤍'
  },
  {
    id: 27,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 הלו״ז שלי בריזורט סופר קפדני: אני נובח, שמוליק מתייצב עם פינוק, אני מנמנם 👑🛌 קשה לנהל מקום כזה, אבל הכל עובד מעולה! {dogName} 🐕👑✨'
  },
  {
    id: 28,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 אם הייתם רואים איך כולם פה קופצים לדום כשאני מתמתח, הייתם מצדיעים לי בעצמכם! 👑🫡 תיהנו איפה שאתם, המלך מסודר! {dogName} 🐶👑🥂'
  },
  {
    id: 29,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 תפסתי בעלות על הסוויטה הכי שווה בריזורט והסברתי לשמוליק שכאן יש רק בוס אחד 👑🐾 הוא הסכים מיד! תבלו בכיף, {dogName} 🐕👑🛋️'
  },
  {
    id: 30,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 נבחתי נביחה אחת קטנה, ושמוליק מיד בדק שהמים קרים והשמיכה ישרה 🛎️💧 השירות פה פשוט ברמה מלכותית! תעשו חיים, {dogName} 🐶👑✨'
  },
  {
    id: 31,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 אני שוקל למנות את שמוליק לעוזר האישי שלי גם כשאחזור הביתה... הוא מיומן מאוד בגירוד מאחורי האוזן! 👂👑 תיהנו בעניינים שלכם, {dogName} 🐕👑😏'
  },
  {
    id: 32,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 בדקתי ביומן המלכותי שלי וראיתי שיש לי זמן פנוי רק לעוד נמנום עמוק אחד הלילה 👑😴 תמשיכו בעיסוקים שלכם בנחת, {dogName} 🐶👑🌙'
  },
  {
    id: 33,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 אל תדאגו לי לרגע – הצוות פה עושה מסדר בוקר ומסדר ערב סביב המיטה שלי 👑🛏️ החיים הטובים לגמרי! ד״ש מ-{dogName} 🐕👑✨'
  },
  {
    id: 34,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 שמעתי שאתם נהנים שם, אז הרשיתי לעצמי לרבוץ כמו קיסר בלי שום נקיפות מצפון 👑🛋️ תבלו, אני פה בשיא הפאר! {dogName} 🐶👑🍷'
  },
  {
    id: 35,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 שמוליק ניסה לשכנע אותי שהיום נגמר, אבל הודעתי לו שמגיע לי עוד סיבוב ליטופים מלכותי 👑💆‍♂️ והוא ביצע מיד! ערב מושלם, {dogName} 🐕👑❤️'
  },
  {
    id: 36,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 עוד יום של שלטון בלעדי בריזורט נסגר בהצלחה מוחצת 👑🐾 תמשיכו לחגוג איפה שאתם, הכל פה טיפ-טופ! {dogName} 🐶👑🎉'
  },
  {
    id: 37,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 הפינוק פה בריזורט כל כך מוגזם שאני שוקל לקנות את המקום ולהעסיק את שמוליק במשרה מלאה... 👑💼 סתם, מתגעגע! תיהנו, {dogName} 🐕👑😉'
  },
  {
    id: 38,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 המיטה שלי פה כל כך רכה שזה מרגיש כמו לשכב על ענן מלכותי ☁️👑 תמשיכו בעיסוקים שלכם, המלך מאושר! {dogName} 🐶👑✨'
  },
  {
    id: 39,
    type: 'safe',
    category: 'boss_dog',
    text: 'היי {ownerName}! 🐾 תרגישו בנוח להישאר עסוקים – הצוות בריזורט משרת אותי ברמת 7 כוכבים פלוס כתר! 👑⭐ באהבה ענקית, {dogName} 🐕👑💎'
  },
  {
    id: 40,
    type: 'safe',
    category: 'boss_dog',
    text: 'ערב טוב {ownerName}! 🐾 יום שלם של הוד מלכותי, טיול בטבע ופינוקים הגיע לסיומו 👑🌲💤 תעשו חיים, אני בסבבה של החיים! {dogName} 🐶👑🏖️'
  },

  // קבוצה 3: הארוחה היומית, שובע עילאי ופינוק VIP (41–60)
  {
    id: 41,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 הארוחה היומית הייתה פשוט מעדן גורמה של 5 כוכבים מישלן! 🍲⭐ ליקקתי את הקערה בנחת ועכשיו הבטן מלאה ומאושרת. תיהנו, {dogName} 🐶😋✨'
  },
  {
    id: 42,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 קיבלתי היום את הקערה העשירה והטעימה שלי בדיוק בזמן 🥩🍲 ואחריה ליטוף ארוך ומפנק בבטן השבעה. תבלו בכיף, {dogName} 🐕😋🤍'
  },
  {
    id: 43,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 ארוחה יומית מושלמת ומשביעה, קערת מים צוננים וצוות שלא מפסיק ללטף 🍲💧 אתם יכולים להיות רגועים לגמרי, אני שבע ומבסוט! {dogName} 🐶🍖✨'
  },
  {
    id: 44,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 בטן מלאה בכל טוב, לב רגוע ומיטה סופר מפנקת 🍲🛋️ מה עוד כלב יכול לבקש בעולם הזה? תמשיכו בעניינים שלכם, {dogName} 🐕🤍✨'
  },
  {
    id: 45,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 הצוות פה יודע בדיוק מתי להגיש את הארוחה היומית ואיך אני אוהב שמגרדים לי מאחורי האוזניים בזמן שאני שבע ומרוצה 🍲👂 הכל מושלם! {dogName} 🐶🥩❤️'
  },
  {
    id: 46,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 אכלתי ארוחה מעולה, שתיתי לרוויה, ועכשיו אני שוכב ונאנח מאושר עם בטן עגולה ומרוצה 🍲💤 תבלו איפה שאתם! באהבה, {dogName} 🐕😋🍖'
  },
  {
    id: 47,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 הגישו לי היום את הארוחה היומית כמו למלך במסעדת יוקרה – טעים, מזין ומשביע בטירוף 🍲👑 תמשיכו ליהנות מהבילויים שלכם, {dogName} 🐶🍽️✨'
  },
  {
    id: 48,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 רק מעדכן שהקערה מבריקה מאושר, הבטן שלי מלאה והזנב מכשכש בקצב שיא 🍲🐾 תעשו חיים, {dogName} 🐕✨🥰'
  },
  {
    id: 49,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 אחרי ארוחה יומית דשנה וטיול מדהים בטבע, אין כלב מאושר ושבע ממני עלי אדמות 🌲🍲 תיהנו מכל רגע, {dogName} 🐶🌳💖'
  },
  {
    id: 50,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 קיבלתי קערה מלאה כל טוב ומנת אהבה ענקית מהצוות 🍲❤️ אני מסודר ושבע לגמרי, תמשיכו בכיף שלכם! {dogName} 🐕🍖✨'
  },
  {
    id: 51,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 הליטופים בבטן אחרי הארוחה היומית פה הם פשוט ברמה בינלאומית 💆‍♂️🍲 רק רציתי שתדעו שהכל פצצה! אוהב, {dogName} 🐶😋🏆'
  },
  {
    id: 52,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 סעודה משובחת, חטיף בריאות טבעי וליטוף מרגיע לפני השינה 🍲✨ אתם בידיים טובות, וגם אני שבע ומפונק! {dogName} 🐕🌙🤍'
  },
  {
    id: 53,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 שבע, רגוע, מבסוט ומנומנם – השילוב האולטימטיבי של סוף יום בריזורט 🍲😴 שיהיה לכם ערב מקסים, {dogName} 🐶💤✨'
  },
  {
    id: 54,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 שמוליק והצוות דואגים לכל ביס ולכל פינוק שלי בדיוק לפי הספר של המלכים 🍲📖👑 תמשיכו לבלות בראש שקט, {dogName} 🐕🍖⭐'
  },
  {
    id: 55,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 הארוחה היומית הייתה כל כך טעימה שליקקתי את השפתיים עשר דקות אחרי! 🍲😋 תיהנו בעניינים שלכם, אני מרוצה עד הגג! {dogName} 🐶✨🍖'
  },
  {
    id: 56,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 בטן מלאה וטובה עושה כלב שליו ומאושר 🍲💤 תבלו איפה שאתם בלי שום דאגות! נשיקות מ-{dogName} 🐕💋🤍'
  },
  {
    id: 57,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 רק מדווח שקיבלתי את מנת האוכל המלכותית שלי ופינוקים ללא הגבלה 🍲👑 תמשיכו ליהנות, הכל פה 100%! {dogName} 🐶🏆✨'
  },
  {
    id: 58,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 מים צוננים, קערת אוכל משובחת ומיטה נוחה – אני מסודר ללילה כמו שצריך! 🍲🛏️ תיהנו המון, {dogName} 🐕🌙✨'
  },
  {
    id: 59,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'היי {ownerName}! 🐾 האוכל היה מדהים, אבל החיבוקים פה בריזורט אחרי הארוחה שווים מיליון דולר 🍲🤗 שיהיה לכם ערב נפלא, {dogName} 🐶❤️✨'
  },
  {
    id: 60,
    type: 'safe',
    category: 'gourmet_meal',
    text: 'ערב טוב {ownerName}! 🐾 סיימתי את הארוחה היומית בנחת, עשיתי מתיחה גדולה ועכשיו אני נרדם מחויך ומרופד 🍲🥱 תעשו חיים, {dogName} 🐕💤👑'
  },

  // קבוצה 4: געגועים חמודים עם קריצה וביטחון (61–80)
  {
    id: 61,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 אני מתגעגע אליכם, אבל בינינו... ממש ממש כיף לי פה, אז קחו את הזמן שלכם בנחת! 🐶😜 תיהנו מכל רגע, אוהב {dogName} ❤️✨'
  },
  {
    id: 62,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 חושב עליכם בין טיול בטבע לתנומה על המיטה המפנקת 🌲🛋️ אבל אל תדאגו – אני חוגג פה בענק! {dogName} 🐕👑💫'
  },
  {
    id: 63,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 רק מוודא שאתם לא מתגעגעים יותר מדי... כי אני פה שקוע בפינוקים וליטופים עד מעל האוזניים! 🐶🥰 נשיקות מ-{dogName} 💋✨'
  },
  {
    id: 64,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 אוהב אתכם מלא, אבל חייב להודות שהחופשה בריזורט באה לי בול בזמן! 🏖️🐶 תמשיכו לעשות חיים משוגעים, {dogName} 🐕🤍🎉'
  },
  {
    id: 65,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 אם חשבתם שאני יושב ובוכה ליד הדלת – תחשבו שוב, אני מקבל עכשיו מסאז\' מלכותי בגב 💆‍♂️👑 תיהנו, {dogName} 🐶✨😎'
  },
  {
    id: 66,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 מקווה שאתם נהנים שם לפחות חצי ממה שאני נהנה פה בריזורט! 🥳🐕 אוהב המון ומשדר אנרגיות שיא, {dogName} 💫❤️'
  },
  {
    id: 67,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 תרגישו חופשי להאריך את התוכניות שלכם, המלך פה ממש לא לחוץ לחזור לשגרה... 👑🏖️ ד״ש מ-{dogName} 🐶😉✨'
  },
  {
    id: 68,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 רק מציץ לוודא שאתם רגועים – אני פה מאושר, מחובק ושמח עד השמיים! 🐶🥰 תמשיכו בעניינים שלכם בכיף, {dogName} 🐕💖✨'
  },
  {
    id: 69,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 אתם בלב שלי תמיד, אבל הריזורט הזה פשוט הצגה של 5 כוכבים! ⭐🌟 תמשיכו לבלות בנחת, {dogName} 🐶👑🥂'
  },
  {
    id: 70,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 אם אתם מרגישים פתאום געגוע, קחו נשימה עמוקה – אני בידיים הכי אוהבות ומקצועיות בעולם! 🐕🤍 תבלו בכיף, {dogName} 🐶✨'
  },
  {
    id: 71,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 נכון שאני מתגעגע קצת, אבל אל תתנו לזה לקלקל לכם את הכיף – אני חוגג פה בטירוף! 🥳🐾 אוהב מלא, {dogName} 🐕🎉❤️'
  },
  {
    id: 72,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 שולח לכם חיבוק חם ורטוב מרחוק, ומיד חוזר להתרפק על המיטה המפנקת שלי בריזורט! 🐶🤗 תיהנו, {dogName} 🐕💤✨'
  },
  {
    id: 73,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 בטוח שאתם חושבים עליי ברגעים אלה... אז הנה אות חיים רשמי: הכל מושלם בריזורט, תבלו בראש שקט! 💌🐶 נשיקות, {dogName} 🐾❤️'
  },
  {
    id: 74,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 איזה מזל שיש לי את הריזורט לכלב! אני חוגג פה חופשת חלומות מהסרטים 🎬🐕 ד״ש חם מ-{dogName} 🐶🍿✨'
  },
  {
    id: 75,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 שולח לכם כשכוש זנב ענק, רוטט ומאושר מכל הלב! 🐾✨ תיהנו איפה שאתם, אני הכי מרוצה בעולם, {dogName} 🐕🥰💖'
  },
  {
    id: 76,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 רק רציתי להגיד תודה ענקית שסידרתם לי חופשה ברמה כזאת בזמן שאתם עסוקים 🙏🐶 תמשיכו בכיף, {dogName} 🐕👑🤍'
  },
  {
    id: 77,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 אל תמהרו לחזור... כלומר ברור שתחזרו, אבל קודם כל תמצו כל שנייה של הנאה! 😜🐾 באהבה ענקית, {dogName} 🐶❤️✨'
  },
  {
    id: 78,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 חושב עליכם באהבה ענקית מתוך הסוויטה המלכותית שלי בריזורט 🌙🛋️ תיהנו המון איפה שאתם, {dogName} 🐕👑💤'
  },
  {
    id: 79,
    type: 'safe',
    category: 'sweet_longing',
    text: 'היי {ownerName}! 🐾 הלב שלי איתכם תמיד, אבל הגוף שלי נח בריזורט ברמת 5 כוכבים פלוס 👑⭐ תבלו בלי שום חשבון, {dogName} 🐶✨💖'
  },
  {
    id: 80,
    type: 'safe',
    category: 'sweet_longing',
    text: 'ערב טוב {ownerName}! 🐾 שולח נשיקה רטובה ישר על האף ומאחל לכם ערב מושלם! 💋🐶 אני פה בעננים המלכותיים, {dogName} 🐕☁️👑'
  },

  // קבוצה 5א: מדשאת משחקים וחברים על 4 - לחברותיים בלבד (81–90)
  {
    id: 81,
    type: 'friendly',
    category: 'lawn',
    text: 'היי {ownerName}! 🐾 השתוללתי היום במדשאת המשחקים עם חברים על 4, רצנו כמו מטורפים ועכשיו אני נרדם מאושר! 🎾🐕 תיהנו שם, {dogName} 🐶🎉💤'
  },
  {
    id: 82,
    type: 'friendly',
    category: 'lawn',
    text: 'ערב טוב {ownerName}! 🐾 המדשאה המשותפת פה פשוט חלום – מלא חברים, משחקי תופסת וכיף של החיים! 🌾🐾 תמשיכו לבלות בכיף, {dogName} 🐕🎾🥳'
  },
  {
    id: 83,
    type: 'friendly',
    category: 'lawn',
    text: 'היי {ownerName}! 🐾 מצאתי לי חבר למשחקים במדשאה ורצנו ביחד עד שהלשון יצאה מאושרת! 🐶👅 ד״ש חם מהדשא, {dogName} 🐾🎾✨'
  },
  {
    id: 84,
    type: 'friendly',
    category: 'lawn',
    text: 'ערב טוב {ownerName}! 🐾 בזמן שאתם בעניינים שלכם, אני עשיתי פה מסיבת ריצות על המדשאה עם כל החבר\'ה 🌾🎉 איזה כיף בריזורט! {dogName} 🐕🐾✨'
  },
  {
    id: 85,
    type: 'friendly',
    category: 'lawn',
    text: 'היי {ownerName}! 🐾 שיחקתי היום במדשאה עם כדורים, רדיפות וחברים, והיה פשוט אש! 🎾🔥 תבלו איפה שאתם, אני מאושר עד הגג, {dogName} 🐶🐾❤️'
  },
  {
    id: 86,
    type: 'friendly',
    category: 'lawn',
    text: 'ערב טוב {ownerName}! 🐾 הדשא במדשאת המשחקים כל כך נעים למרדפים, ששמוליק היה צריך לשכנע אותי להיכנס לסוויטה... 🌾🐾 תעשו חיים, {dogName} 🐕😄🛋️'
  },
  {
    id: 87,
    type: 'friendly',
    category: 'lawn',
    text: 'היי {ownerName}! 🐾 איזה נבחרת של חברים מצאתי לי במדשאה! כולם כשכשו בזנב באושר ושמחה 🐶🐾 תיהנו בכיף שלכם, {dogName} 🐕🎾🥳'
  },
  {
    id: 88,
    type: 'friendly',
    category: 'lawn',
    text: 'ערב טוב {ownerName}! 🐾 שרפתי את כל המרץ במשחקים חברתיים במדשאה, ועכשיו אני שוכב ונרדם כמו מלך 🌾👑 אוהב המון, {dogName} 🐶💤✨'
  },
  {
    id: 89,
    type: 'friendly',
    category: 'lawn',
    text: 'היי {ownerName}! 🐾 כמות הכשכושים במדשאת המשחקים היום שברה את כל השיאים העולמיים! 🐾🏆 תמשיכו לחגוג, הכל פה מושלם! {dogName} 🐕🥳💖'
  },
  {
    id: 90,
    type: 'friendly',
    category: 'lawn',
    text: 'ערב טוב {ownerName}! 🐾 המדשאה פה פשוט אליפות! הוצאתי אנרגיות, שמחתי ועכשיו נכנס ללילה רגוע ושלו 🌾🌙 {dogName} 🐶💤✨'
  },

  // קבוצה 5ב: מותאם אישית לבידוד / תוקפניים / שקט ופרטיות (91–100)
  {
    id: 91,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'היי {ownerName}! 🐾 קיבלתי היום יחס VIP אישי של 1-על-1 עם המטפל שלי בטיול בטבע, בלי שאף אחד יפריע לי למלכות! 🌲👑 תיהנו בעניינים שלכם, {dogName} 🐶💎✨'
  },
  {
    id: 92,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'ערב טוב {ownerName}! 🐾 המרחב הפרטי שלי בריזורט פשוט מושלם! שקט מוחלט, שלווה, טיול ארוך בטבע ופינוק אישי שמגיע רק לי 🌲🐾 ד״ש חם מ-{dogName} 🐕👑✨'
  },
  {
    id: 93,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'היי {ownerName}! 🐾 המטפלים פה מבינים אותי בדיוק – יצאתי לטיול שקט ומהנה בטבע, וחזרתי לסוויטה המלכותית הפרטית שלי לנוח 🌲🛋️ תבלו בכיף, {dogName} 🐶👑🤍'
  },
  {
    id: 94,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'ערב טוב {ownerName}! 🐾 שום רעש ושום הפרעות! רק אני, המטפל האוהב שלי, טיול בטבע וליטופים בלי סוף 🌲💆‍♂️ אני רגוע לחלוטין! אוהב, {dogName} 🐕👑💖'
  },
  {
    id: 95,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'היי {ownerName}! 🐾 יש לי פה שקט ושלווה בדיוק כמו שאני אוהב, טיול בטבע של אלופים וזמן איכות אישי 🌲🌿 תיהנו שם, המלך שלכם רגוע! {dogName} 🐶👑✨'
  },
  {
    id: 96,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'ערב טוב {ownerName}! 🐾 הטיול האישי שלי בטבע היה מדהים! שמוליק והצוות נתנו לי 100% תשומת לב פרטית ומסורה 🌲❤️ שיהיה לכם ערב נפלא, {dogName} 🐕👑🥰'
  },
  {
    id: 97,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'היי {ownerName}! 🐾 אני בסוויטה המרווחת שלי, שבע ומרוצה עד הגג אחרי יום של שקט, פרטיות ופינוקים 🛋️👑 אל תדאגו לי לשנייה! {dogName} 🐶💎💤'
  },
  {
    id: 98,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'ערב טוב {ownerName}! 🐾 בזמן שאתם עסוקים, אני נהנה מפרטיות מוחלטת, טיול פרטי בטבע ואהבה אינסופית מהצוות 🌲🤍 תעשו חיים, {dogName} 🐕👑✨'
  },
  {
    id: 99,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'היי {ownerName}! 🐾 הפינוק האישי פה בריזורט מושלם עבורי – שקט, בטוח, שליו ומלא כבוד למלך 👑🐾 תמשיכו בכיף שלכם בראש שקט לגמרי! {dogName} 🐶🙏✨'
  },
  {
    id: 100,
    type: 'isolation',
    category: 'isolation_vip',
    text: 'ערב טוב {ownerName}! 🐾 יום שקט, שליו ומלא ליטופים אישיים הסתיים. אני ישן כמו מלך אמיתי בסוויטה הפרטית שלי 👑🛋️💤 אוהב תמיד, {dogName} 🐕👑🤍'
  },

  // קבוצה 6: תוכנית אילוף וחינוך משמעת מקצועית עם שמוליק (101–120) [בהומור שנון ומצחיק מנקודת מבטו של הכלב!]
  {
    id: 101,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 למדתי היום עם שמוליק מלא דברים חדשים ומשמעת של אלופים! 🎓🐶 בינתיים עוד לא הגענו לשיעור של איך להכין לכם קפה על הבוקר, אבל תנו לי עוד כמה ימים... 😉☕ אוהב, {dogName} ❤️'
  },
  {
    id: 102,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 שמוליק המאלף לימד אותי היום להקשיב, לשבת ולהישאר כמו מקצוען! 🐕🎓 עכשיו רק נשאר לו ללמד אותי לקפל כביסה ולהפעיל מכונה על 40 מעלות 🧺👕 אל תדאגו, אני עובד על זה! {dogName} ✨'
  },
  {
    id: 103,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 מעדכן מהשטח: סשן האילוף היום היה אליפות! 🎓🐾 קלטתי הכל תוך שנייה. שמוליק אמר שברגע שאסיים את הקורס, אני עובר ישר לשטוף את הכלים בכיור במקומכם 🍽️🧼 תיהנו בעניינים שלכם, {dogName} 🐶😎'
  },
  {
    id: 104,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 עוד יום של למידה ומשמעת ברזל מאחוריי! 🎓🏆 אני כבר יודע ללכת רגוע, לא למשוך ולהקשיב. השלב הבא בסילבוס של שמוליק: להחזיק מגב ולעשות ספונג\'ה בבית בשישי! 🧹🧼 ד״ש חם מ-{dogName} 🐕✨'
  },
  {
    id: 105,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 תרגלתי היום שליטה עצמית ופקודות מתקדמות עם שמוליק! 🐾🎓 הוא טוען שאם אמשיך ככה בקצב הזה, אני חוזר הביתה עם רישיון נהיגה ואני זה שמסיע אתכם לעבודה 🚗💨 מחכה לראות אתכם, {dogName} 🐶❤️'
  },
  {
    id: 106,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 שמוליק שם לי היום אתגרים באילוף, אבל עברתי אותם כמו טייס קרב! ✈️🐶 עבדנו על פוקוס והקשבה, ונראה לי שעד סוף השבוע אני כבר מטיס אתכם לחופשה בחו״ל! 🧳 תמשיכו לבלות בנחת, {dogName} 🐶✨'
  },
  {
    id: 107,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 סשן האילוף היום שבר שיאים! 🎓🐕 שמוליק לימד אותי פקודות הישארות ואיפוק. השלב הבא: ללמד אותי להקליד את הקוד בטלפון ולהזמין לנו וולט לסלון 🍕📱 תבלו בכיף, {dogName} 🐕👏'
  },
  {
    id: 108,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 שילבתי היום בין אימון אילוף מקצועי עם שמוליק למנוחה בסוויטה שלי 🛋️🎓 נהייתי כזה ממושמע ורציני, ששמוליק שוקל לשים אותי במקומכם בשיחות זום מול הבוס מחר בבוקר! 💼👔 {dogName} 🐶👑'
  },
  {
    id: 109,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 שיעור האילוף היום עבר בהצלחה מסחררת! 🏆🐶 שמוליק אמר שאני כזה תלמיד חכם ומבריק, שרק חסר שאלמד להגיש דוחות מס ולשלם חשמל בזמן 📈💡 תמשיכו בכיף שלכם, {dogName} 🐕❤️'
  },
  {
    id: 110,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 שמוליק ואני עובדים על הרגלים מעולים והתנהגות למופת 🎓🐾 אם עד היום נבחתי על השואב הרובוטי, בקרוב אני מתכוון לתפעל אותו ולרוקן את הפילטר בעצמי! 🤖🧹 נשיקות מ-{dogName} 🐶💋✨'
  },
  {
    id: 111,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 סיימתי עוד יום גדוש בלמידה ותרגול פקודות. שמוליק מרוצה עד הגג! 🎓🐕 שאלתי אותו מתי לומדים להכין לכם חביתה וסלט קצוץ דק, והוא הבטיח שזה במודול המתקדם 🍳🥗 אוהב המון, {dogName} 🐶💤'
  },
  {
    id: 112,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 שיעור האילוף היום הוציא ממני את כל האנרגיה בכיף ענק! 🎓🌟 שמוליק לימד אותי לשחרר חפצים בפקודה – עכשיו רק נשאר לשכנע אותי לקחת את שקית הזבל לפח ביציאה מהבית 🗑️🚶‍♂️ תעשו חיים, {dogName} 🐕✨'
  },
  {
    id: 113,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 תרגלנו היום עבודה עם גירויים ורוגע מוחלט. שמוליק טוען שאחרי כל מה שלמדתי, כשאחזור הביתה אני חייב לכם לפחות מסאז\' גב של חצי שעה 💆‍♂️🐶 מחכה לראות אתכם, {dogName} ❤️'
  },
  {
    id: 114,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 האילוף בריזורט עובד פלאים! 🎓🐾 התנועות שלי נהיו כאלה מדויקות וממושמעות, ששמוליק בודק אם אפשר לרשום אותי לשיעורי פסנתר וכינור 🎹🎻 שיהיה לכם ערב נפלא, {dogName} 🐕🥰'
  },
  {
    id: 115,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 בזמן שאתם בעניינים שלכם, אני הופך פה לדוקטור למשמעת! 🎓🐶 שמוליק אומר שאני כזה גאון שאוטוטו אני לומד גם להחליף נורות שרופות ולתקן מדפים בבית 🔧💡 תיהנו בכיף, {dogName} 🐶👑✨'
  },
  {
    id: 116,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 עבדנו היום על גבולות, רוגע והקשבה ללא רבב! 🎓🐾 שמוליק הבטיח שאם אמשיך להצטיין, השיעור הבא יהיה איך לסובב את המפתח במנעול ולפתוח לכם כשאתם חוזרים עם קניות 🔑🛍️ {dogName} 🐕🏆'
  },
  {
    id: 117,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 היום פיצחנו עוד תרגיל אילוף ברמת מומחה! 🎓👏 שמוליק אומר שאני מתקדם כל כך יפה, שבקרוב אני גם אוציא את המשפך ואשקה את הסחלבים במרפסת 🪴🚿 גאה בעצמי, {dogName} 🐶❤️'
  },
  {
    id: 118,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 אחרי סשן אילוף מעצים, התפנקתי בארוחה טעימה 🥣🎓 השלב הבא באילוף: ללמוד להעביר לכם פרק בנטפליקס כשאתם מתעצלים לקום לשלט 📺🍿 אוהב מלא, {dogName} 🐕💤✨'
  },
  {
    id: 119,
    type: 'training',
    category: 'training_progress',
    text: 'היי {ownerName}! 🐾 תרגלתי היום הליכה רגועה ותרגילים חדשים לצד שמוליק. מרגיש שאני בוגר ברמות! 🎓🐶 שאלתי אם יש מצב שאני אלמד גם לפרוק את המדיח, שמוליק אמר שקודם נלמד לא לאכול גרביים... 🧦😂 ד״ש חם מ-{dogName} ✨'
  },
  {
    id: 120,
    type: 'training',
    category: 'training_progress',
    text: 'ערב טוב {ownerName}! 🐾 לסיכום היום: 100% הקשבה באילוף, 100% פינוק משמוליק, ותעודת הצטיינות בדרך! 🎓🏅 נראה לי שעם הרמה שהגעתי אליה, אני מוכן לנהל ישיבת דירקטוריון מחר בבוקר 👔💼 נתראה בקרוב, {dogName} 🐶👑✨'
  }
];

/**
 * בדיקה האם כלב מוגדר בבידוד / תוקפני
 */
export function isDogIsolationRequired(
  bookingNotes?: string,
  behaviorNotes?: string,
  dailyRate?: number,
  isFriendlyWithDogs?: 'yes' | 'no' | 'depends' | string
): boolean {
  if (isFriendlyWithDogs === 'no') return true;
  if (dailyRate === 230) return true;
  const combinedText = `${bookingNotes || ''} ${behaviorNotes || ''}`.toLowerCase();
  if (
    combinedText.includes('בידוד') ||
    combinedText.includes('תוקפנ') ||
    combinedText.includes('לא מסתדר') ||
    combinedText.includes('לא חברותי') ||
    combinedText.includes('שקט בלבד')
  ) {
    return true;
  }
  return false;
}

/**
 * בדיקה האם כלב נמצא בתוכנית אילוף / פנסיון אילוף
 */
export function isDogInTraining(
  serviceType?: string,
  notes?: string,
  behaviorNotes?: string,
  intakeServiceType?: string
): boolean {
  if (
    serviceType === 'training' ||
    serviceType === 'day_training' ||
    serviceType === 'combined' ||
    intakeServiceType === 'training' ||
    intakeServiceType === 'day_training' ||
    intakeServiceType === 'combined'
  ) {
    return true;
  }
  const text = `${notes || ''} ${behaviorNotes || ''}`.toLowerCase();
  if (
    text.includes('אילוף') ||
    text.includes('מאלף') ||
    text.includes('משמעת') ||
    text.includes('חינוך גור') ||
    text.includes('שיעור')
  ) {
    return true;
  }
  return false;
}

/**
 * הגרלת תבנית מתאימה מתוך המאגר בהתאם לסטטוס הכלב
 * - הפרדה מלאה בין פנסיון לאילוף: כלב באילוף מקבל אך ורק נוסחי אילוף ייעודיים!
 * - מונע שימוש בתבניות שכבר נשלחו במהלך השהות
 * - מסנן הרמטית תבניות מדשאה (81-90) מכלבים בבידוד
 */
export function pickDailyDogTemplate(
  ownerName: string,
  dogName: string,
  isIsolation: boolean,
  alreadyUsedTemplateIds: number[] = [],
  isTraining: boolean = false,
  isFemale: boolean = false
): { template: DailyDogTemplate; formattedText: string } {
  let eligibleTemplates: DailyDogTemplate[] = [];

  if (isTraining) {
    // כלב באילוף: מקבל אך ורק נוסחי אילוף מעצימים עם שמוליק!
    eligibleTemplates = DAILY_DOG_TEMPLATES.filter(t => t.type === 'training');
    if (eligibleTemplates.length === 0) {
      eligibleTemplates = DAILY_DOG_TEMPLATES.filter(t => t.type === 'safe');
    }
  } else if (isIsolation) {
    // כלב בבידוד: מקבל רק safe או isolation (לעולם לא friendly ולא training!)
    eligibleTemplates = DAILY_DOG_TEMPLATES.filter(t => t.type === 'safe' || t.type === 'isolation');
  } else {
    // כלב חברותי בפנסיון: מקבל safe, friendly או isolation (ללא אילוף)
    eligibleTemplates = DAILY_DOG_TEMPLATES.filter(t => t.type !== 'training');
  }

  // סינון תבניות שכבר נשלחו בשהות הנוכחית
  let unusedTemplates = eligibleTemplates.filter(t => !alreadyUsedTemplateIds.includes(t.id));

  // אם מוצו כל התבניות, מאפסים את מעקב השימוש
  if (unusedTemplates.length === 0) {
    unusedTemplates = eligibleTemplates;
  }

  const chosenIndex = Math.floor(Math.random() * unusedTemplates.length);
  const template = unusedTemplates[chosenIndex] || eligibleTemplates[0];

  const cleanOwner = (ownerName || '').trim().split(' ')[0] || 'לקוח יקר';
  const cleanDog = (dogName || '').trim() || 'החבר על 4';

  let formattedText = template.text
    .replace(/{ownerName}/g, cleanOwner)
    .replace(/{dogName}/g, cleanDog);

  if (isFemale) {
    formattedText = formattedText
      // ברכות סיום וחיבה
      .replace(/אוהב\s+{dogName}/g, `אוהבת ${cleanDog}`)
      .replace(/אוהב\s+המון,\s+{dogName}/g, `אוהבת המון, ${cleanDog}`)
      .replace(/אוהב,\s+{dogName}/g, `אוהבת, ${cleanDog}`)
      .replace(/אוהב\s+אותכם/g, 'אוהבת אתכם')
      .replace(/אוהב\s+אתכם/g, 'אוהבת אתכם')
      .replace(/אוהב\s+המון/g, 'אוהבת המון')
      .replace(/אוהב\s+מלא/g, 'אוהבת מלא')
      .replace(/אוהב(?![תותםן])/g, 'אוהבת')
      // שכיבה ומנוחה
      .replace(/שוכב\s+רגוע\s+ומרוצה/g, 'שוכבת רגועה ומרוצה')
      .replace(/שוכב\s+מרוצה/g, 'שוכבת מרוצה')
      .replace(/שוכב\s+בכיף/g, 'שוכבת בכיף')
      .replace(/שוכב\s+על\s+הגב/g, 'שוכבת על הגב')
      .replace(/שוכב(?![תותםן])/g, 'שוכבת')
      // שינה
      .replace(/ישן\s+עמוק\s+ושלו/g, 'ישנה עמוק ושלווה')
      .replace(/ישן\s+עמוק/g, 'ישנה עמוק')
      .replace(/ישן(?![הותםן])/g, 'ישנה')
      .replace(/נרדם\s+מחויך\s+ומרופד/g, 'נרדמת מחויכת ומרופדת')
      .replace(/נרדם\s+מחויך/g, 'נרדמת מחויכת')
      .replace(/נרדם(?![תותםן])/g, 'נרדמת')
      // מנוחה ומלכות
      .replace(/נח\s+כמו\s+מלך\s+אמיתי/g, 'נחה כמו מלכה אמיתית')
      .replace(/נח\s+כמו\s+מלך/g, 'נחה כמו מלכה')
      .replace(/נח\s+בסוויטה/g, 'נחה בסוויטה')
      .replace(/נח\s+בכיף/g, 'נחה בכיף')
      .replace(/נח(?![הותםן])/g, 'נחה')
      .replace(/כמו\s+מלך\s+אמיתי/g, 'כמו מלכה אמיתית')
      .replace(/כמו\s+מלך/g, 'כמו מלכה')
      .replace(/מלך\s+אמיתי/g, 'מלכה אמיתית')
      .replace(/שייח'\s+אמיתי/g, 'נסיכה אמיתית')
      .replace(/נסיך\s+אמיתי/g, 'נסיכה אמיתית')
      .replace(/נסיך(?![הותםן])/g, 'נסיכה')
      .replace(/הוד\s+מעלתו/g, 'הוד מעלתה')
      // ארוחה וסידור ללילה
      .replace(/אני\s+מסודר\s+ללילה\s+כמו\s+שצריך/g, 'אני מסודרת ללילה כמו שצריך')
      .replace(/מסודר\s+ללילה/g, 'מסודרת ללילה')
      .replace(/מסודר\s+ושבע\s+לגמרי/g, 'מסודרת ושבעה לגמרי')
      .replace(/מסודר\s+ושבע/g, 'מסודרת ושבעה')
      .replace(/אני\s+מסודר/g, 'אני מסודרת')
      .replace(/מסודר(?![תותםן])/g, 'מסודרת')
      .replace(/שבע\s+ומבסוט/g, 'שבעה ומבסוטה')
      .replace(/שבע\s+ומרוצה/g, 'שבעה ומרוצה')
      .replace(/שבע(?![הותםן])/g, 'שבעה')
      .replace(/כלב\s+שליו\s+ומאושר/g, 'כלבה שלווה ומאושרת')
      // געגועים ורגשות
      .replace(/מתגעגע\s+אליכם/g, 'מתגעגעת אליכם')
      .replace(/מתגעגע(?![תותםן])/g, 'מתגעגעת')
      .replace(/חושב\s+עליכם/g, 'חושבת עליכם')
      .replace(/חושב(?![תותםן])/g, 'חושבת')
      .replace(/חוגג\s+פה\s+בענק/g, 'חוגגת פה בענק')
      .replace(/חוגג(?![תותםן])/g, 'חוגגת')
      .replace(/שמח\s+ומאושר/g, 'שמחה ומאושרת')
      .replace(/שמח(?![הותםן])/g, 'שמחה')
      // אילוף ופעילות
      .replace(/מצטיין(?![תותםן])/g, 'מצטיינת')
      .replace(/מתקדם(?![תותםן])/g, 'מתקדמת')
      .replace(/עובד\s+על\s+זה/g, 'עובדת על זה')
      .replace(/חוזר\s+הביתה/g, 'חוזרת הביתה')
      .replace(/אני\s+זה\s+שמסיע/g, 'אני זו שמסיעה')
      .replace(/שקוע\s+עמוק/g, 'שקועה עמוק')
      .replace(/שקוע\s+בפינוקים/g, 'שקועה בפינוקים')
      .replace(/טייס\s+קרב/g, 'טייסת קרב')
      .replace(/מטיס(?![הותםן])/g, 'מטיסה')
      .replace(/ממושמע\s+ורציני/g, 'ממושמעת ורצינית')
      .replace(/ממושמע(?![תותםן])/g, 'ממושמעת')
      .replace(/רציני(?![תותםן])/g, 'רצינית')
      .replace(/תלמיד\s+חכם\s+ומבריק/g, 'תלמידה חכמה ומבריקה')
      .replace(/תלמיד\s+חכם/g, 'תלמידה חכמה')
      .replace(/תלמיד\s+מצטיין/g, 'תלמידה מצטיינת')
      .replace(/תלמיד(?![הותםן])/g, 'תלמידה')
      .replace(/דוקטור\s+למשמעת/g, 'דוקטורית למשמעת')
      .replace(/דוקטור(?![יתותםן])/g, 'דוקטורית')
      .replace(/גאון(?![הותםן])/g, 'גאונה')
      .replace(/בוגר\s+ברמות/g, 'בוגרת ברמות')
      .replace(/בוגר(?![תותםן])/g, 'בוגרת')
      .replace(/מוכן\s+לנהל/g, 'מוכנה לנהל')
      .replace(/מוכן(?![הותםן])/g, 'מוכנה')
      .replace(/עייף\s+ומרוצה/g, 'עייפה ומרוצה')
      .replace(/עייף(?![הותםן])/g, 'עייפה')
      .replace(/מפוקס(?![תותםן])/g, 'מפוקסת')
      .replace(/מרוכז(?![תותםן])/g, 'מרוכזת')
      .replace(/משתולל(?![תותםן])/g, 'משתוללת')
      .replace(/מתפנק(?![תותםן])/g, 'מתפנקת')
      .replace(/מתאמן(?![תותםן])/g, 'מתאמנת')
      .replace(/מתרגל(?![תותםן])/g, 'מתרגלת')
      .replace(/אלופים\s+אמיתיים/g, 'אלופות אמיתיות')
      .replace(/אלופים(?![ותםן])/g, 'אלופות');
  }

  return { template, formattedText };
}
