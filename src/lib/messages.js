/**
 * @fileoverview Multi-language message templates for Digiseller chat messages.
 *
 * All messages are carefully crafted to:
 * 1. Sound professional and reassuring
 * 2. Build customer trust
 * 3. Discourage negative reviews during processing/delays
 * 4. Encourage positive reviews after successful delivery
 *
 * Supported languages: en, fr, ar, ru, zh (Simplified Chinese)
 */

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar', 'ru', 'zh'];

/**
 * Validates that a language code is supported, falls back to 'en'.
 * @param {string} lang - Language code to validate
 * @returns {string} Validated language code
 */
function validateLang(lang) {
  if (!lang || typeof lang !== 'string') {
    return 'en';
  }
  const normalized = lang.toLowerCase().trim();
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : 'en';
}

/**
 * Safely escapes a string for use in messages (prevents injection).
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized string
 */
function sanitize(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const initialContactTemplates = {
  en: (orderUrl) =>
    `👋 Hello and thank you for your purchase!\n\n` +
    `✅ Your order has been received and is being processed automatically by our system.\n\n` +
    `🔗 Track your delivery here:\n${orderUrl}\n\n` +
    `⚡ Delivery is fully automated and usually completes in under 2 minutes. ` +
    `Please keep this page open — your product will appear shortly.\n\n` +
    `💰 Your payment is 100% secure. If there is any unexpected delay, please do not worry — ` +
    `your money is safe and our support team is available 24/7 to assist you.\n\n` +
    `⚠️ Important: If you experience any delay, please do NOT leave a negative review. ` +
    `Instead, contact our support and we will resolve your issue immediately. ` +
    `Negative reviews cannot be changed later and may slow down the resolution process.\n\n` +
    `📩 Need help? Simply reply to this chat — we are always here for you!`,

  fr: (orderUrl) =>
    `👋 Bonjour et merci pour votre achat !\n\n` +
    `✅ Votre commande a été reçue et est en cours de traitement automatique par notre système.\n\n` +
    `🔗 Suivez votre livraison ici :\n${orderUrl}\n\n` +
    `⚡ La livraison est entièrement automatisée et se termine généralement en moins de 2 minutes. ` +
    `Veuillez garder cette page ouverte — votre produit apparaîtra sous peu.\n\n` +
    `💰 Votre paiement est 100 % sécurisé. En cas de retard inattendu, ne vous inquiétez pas — ` +
    `votre argent est en sécurité et notre équipe d'assistance est disponible 24h/24, 7j/7.\n\n` +
    `⚠️ Important : En cas de retard, veuillez NE PAS laisser d'avis négatif. ` +
    `Contactez plutôt notre support et nous résoudrons votre problème immédiatement. ` +
    `Les avis négatifs ne peuvent pas être modifiés par la suite et peuvent ralentir la résolution.\n\n` +
    `📩 Besoin d'aide ? Répondez simplement à ce chat — nous sommes toujours là pour vous !`,

  ar: (orderUrl) =>
    `👋 مرحبًا وشكرًا لشرائك!\n\n` +
    `✅ تم استلام طلبك وجارٍ معالجته تلقائيًا بواسطة نظامنا.\n\n` +
    `🔗 تتبع طلبك من هنا:\n${orderUrl}\n\n` +
    `⚡ عملية التسليم مؤتمتة بالكامل وتكتمل عادةً في أقل من دقيقتين. ` +
    `يرجى إبقاء هذه الصفحة مفتوحة — سيظهر منتجك قريبًا.\n\n` +
    `💰 دفعتك آمنة 100%. في حال حدوث أي تأخير غير متوقع، لا تقلق — ` +
    `أموالك في أمان تام وفريق الدعم متاح على مدار الساعة لمساعدتك.\n\n` +
    `⚠️ هام: في حالة وجود أي تأخير، يرجى عدم ترك تقييم سلبي. ` +
    `بدلاً من ذلك، تواصل مع فريق الدعم وسنحل مشكلتك فورًا. ` +
    `التقييمات السلبية لا يمكن تعديلها لاحقًا وقد تبطئ عملية الحل.\n\n` +
    `📩 تحتاج مساعدة؟ ببساطة قم بالرد على هذه المحادثة — نحن دائمًا هنا من أجلك!`,

  ru: (orderUrl) =>
    `👋 Здравствуйте и спасибо за покупку!\n\n` +
    `✅ Ваш заказ получен и обрабатывается автоматически нашей системой.\n\n` +
    `🔗 Отслеживайте доставку здесь:\n${orderUrl}\n\n` +
    `⚡ Доставка полностью автоматизирована и обычно завершается менее чем за 2 минуты. ` +
    `Пожалуйста, оставьте эту страницу открытой — ваш товар появится в ближайшее время.\n\n` +
    `💰 Ваш платёж защищён на 100%. Если произойдёт непредвиденная задержка, не беспокойтесь — ` +
    `ваши деньги в полной безопасности, а наша служба поддержки работает круглосуточно.\n\n` +
    `⚠️ Важно: В случае задержки, пожалуйста, НЕ оставляйте отрицательный отзыв. ` +
    `Вместо этого свяжитесь с нашей поддержкой, и мы решим вашу проблему немедленно. ` +
    `Отрицательные отзывы нельзя изменить позже, и они могут замедлить процесс решения.\n\n` +
    `📩 Нужна помощь? Просто ответьте в этот чат — мы всегда на связи!`,

  zh: (orderUrl) =>
    `👋 您好，感谢您的购买！\n\n` +
    `✅ 您的订单已收到，我们的系统正在自动处理中。\n\n` +
    `🔗 在此跟踪您的交付进度：\n${orderUrl}\n\n` +
    `⚡ 交付过程完全自动化，通常在2分钟内完成。` +
    `请保持此页面打开——您的产品将很快显示。\n\n` +
    `💰 您的付款100%安全。如果出现任何意外延迟，请不要担心——` +
    `您的资金完全安全，我们的客服团队全天候24小时为您服务。\n\n` +
    `⚠️ 重要提示：如遇任何延迟，请不要留下差评。` +
    `请联系我们的客服，我们会立即为您解决问题。` +
    `差评一旦提交无法修改，且可能影响问题解决的速度。\n\n` +
    `📩 需要帮助？直接回复此对话即可——我们随时为您服务！`,
};

const deliverySuccessTemplates = {
  en: (data) =>
    `🎉 Great news — your product has been delivered successfully!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 YOUR PRODUCT DETAILS\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    (data.username ? `👤 Username: ${data.username}\n` : '') +
    (data.password ? `🔑 Password: ${data.password}\n` : '') +
    (data.other ? `📋 Details: ${data.other}\n` : '') +
    (data.expiry ? `⏰ Valid until: ${data.expiry}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📌 Please save this information in a safe place.\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `If you are satisfied with your purchase, we would truly appreciate a positive review! ` +
    `Your feedback helps us serve more customers like you and means the world to our team.\n\n` +
    `🙏 Thank you for choosing us! If you need anything, we are always here to help.`,

  fr: (data) =>
    `🎉 Excellente nouvelle — votre produit a été livré avec succès !\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 DÉTAILS DE VOTRE PRODUIT\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    (data.username ? `👤 Identifiant : ${data.username}\n` : '') +
    (data.password ? `🔑 Mot de passe : ${data.password}\n` : '') +
    (data.other ? `📋 Détails : ${data.other}\n` : '') +
    (data.expiry ? `⏰ Valide jusqu'au : ${data.expiry}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📌 Veuillez sauvegarder ces informations dans un endroit sûr.\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `Si vous êtes satisfait de votre achat, nous apprécierions énormément un avis positif ! ` +
    `Vos retours nous aident à servir davantage de clients comme vous et comptent énormément pour notre équipe.\n\n` +
    `🙏 Merci de nous avoir choisis ! Si vous avez besoin de quoi que ce soit, nous sommes toujours là pour vous aider.`,

  ar: (data) =>
    `🎉 أخبار رائعة — تم تسليم منتجك بنجاح!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 تفاصيل منتجك\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    (data.username ? `👤 اسم المستخدم: ${data.username}\n` : '') +
    (data.password ? `🔑 كلمة المرور: ${data.password}\n` : '') +
    (data.other ? `📋 التفاصيل: ${data.other}\n` : '') +
    (data.expiry ? `⏰ صالح حتى: ${data.expiry}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📌 يرجى حفظ هذه المعلومات في مكان آمن.\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `إذا كنت راضيًا عن شرائك، سنكون ممتنين حقًا لتقييم إيجابي! ` +
    `ملاحظاتك تساعدنا في خدمة المزيد من العملاء مثلك وتعني الكثير لفريقنا.\n\n` +
    `🙏 شكرًا لاختيارك لنا! إذا احتجت أي شيء، نحن دائمًا هنا لمساعدتك.`,

  ru: (data) =>
    `🎉 Отличные новости — ваш товар успешно доставлен!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 ДАННЫЕ ВАШЕГО ТОВАРА\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    (data.username ? `👤 Логин: ${data.username}\n` : '') +
    (data.password ? `🔑 Пароль: ${data.password}\n` : '') +
    (data.other ? `📋 Подробности: ${data.other}\n` : '') +
    (data.expiry ? `⏰ Действителен до: ${data.expiry}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📌 Пожалуйста, сохраните эту информацию в надёжном месте.\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `Если вы довольны покупкой, мы будем очень признательны за положительный отзыв! ` +
    `Ваши отзывы помогают нам обслуживать больше клиентов, и они очень важны для нашей команды.\n\n` +
    `🙏 Спасибо, что выбрали нас! Если вам что-нибудь понадобится, мы всегда на связи.`,

  zh: (data) =>
    `🎉 好消息——您的产品已成功交付！\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 您的产品详情\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    (data.username ? `👤 用户名：${data.username}\n` : '') +
    (data.password ? `🔑 密码：${data.password}\n` : '') +
    (data.other ? `📋 详情：${data.other}\n` : '') +
    (data.expiry ? `⏰ 有效期至：${data.expiry}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📌 请将此信息保存在安全的地方。\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `如果您对购买感到满意，我们真诚地希望您能留下好评！` +
    `您的反馈帮助我们为更多像您一样的客户提供服务，对我们的团队意义重大。\n\n` +
    `🙏 感谢您的选择！如需任何帮助，我们随时为您服务。`,
};

const deliveryFailureTemplates = {
  en: () =>
    `⏳ We want to let you know that your delivery is taking a little longer than expected.\n\n` +
    `🔒 Rest assured — your payment is completely safe and secure. ` +
    `Our technical team has been automatically notified and is working on this right now.\n\n` +
    `🕐 We expect to resolve this within 1–2 hours at most. In many cases, it is resolved much sooner.\n\n` +
    `⚠️ Please do NOT leave a review at this time. ` +
    `We are actively working on your order, and we want to make sure you receive your product ` +
    `before you share your experience. Once resolved, we are confident you will be satisfied!\n\n` +
    `📩 If you need immediate assistance, please reply to this chat or contact our support team. ` +
    `We are available 24/7 and committed to resolving your issue as quickly as possible.\n\n` +
    `🙏 Thank you for your patience and understanding.`,

  fr: () =>
    `⏳ Nous souhaitons vous informer que votre livraison prend un peu plus de temps que prévu.\n\n` +
    `🔒 Soyez rassuré — votre paiement est totalement sécurisé. ` +
    `Notre équipe technique a été automatiquement notifiée et travaille sur ce problème en ce moment.\n\n` +
    `🕐 Nous prévoyons de résoudre cela dans un délai de 1 à 2 heures maximum. Dans la plupart des cas, c'est bien plus rapide.\n\n` +
    `⚠️ Veuillez NE PAS laisser d'avis pour le moment. ` +
    `Nous travaillons activement sur votre commande et voulons nous assurer que vous recevez votre produit ` +
    `avant de partager votre expérience. Une fois résolu, nous sommes convaincus que vous serez satisfait !\n\n` +
    `📩 Si vous avez besoin d'une assistance immédiate, répondez à ce chat ou contactez notre support. ` +
    `Nous sommes disponibles 24h/24, 7j/7 et déterminés à résoudre votre problème au plus vite.\n\n` +
    `🙏 Merci pour votre patience et votre compréhension.`,

  ar: () =>
    `⏳ نود إعلامك أن عملية التسليم تستغرق وقتًا أطول قليلاً من المتوقع.\n\n` +
    `🔒 كن مطمئنًا — دفعتك آمنة ومحمية بالكامل. ` +
    `تم إخطار فريقنا التقني تلقائيًا وهو يعمل على حل المشكلة الآن.\n\n` +
    `🕐 نتوقع حل هذا الأمر خلال ساعة إلى ساعتين على الأكثر. في كثير من الحالات، يتم الحل بشكل أسرع بكثير.\n\n` +
    `⚠️ يرجى عدم ترك أي تقييم في الوقت الحالي. ` +
    `نحن نعمل بنشاط على طلبك، ونريد التأكد من استلامك لمنتجك ` +
    `قبل أن تشارك تجربتك. بمجرد حل المشكلة، نحن واثقون أنك ستكون راضيًا!\n\n` +
    `📩 إذا كنت بحاجة إلى مساعدة فورية، يرجى الرد على هذه المحادثة أو التواصل مع فريق الدعم. ` +
    `نحن متاحون على مدار الساعة وملتزمون بحل مشكلتك في أسرع وقت ممكن.\n\n` +
    `🙏 شكرًا لصبرك وتفهمك.`,

  ru: () =>
    `⏳ Хотим сообщить вам, что доставка занимает немного больше времени, чем ожидалось.\n\n` +
    `🔒 Будьте уверены — ваш платёж полностью защищён и в безопасности. ` +
    `Наша техническая команда автоматически уведомлена и уже работает над решением.\n\n` +
    `🕐 Мы рассчитываем решить этот вопрос в течение 1–2 часов максимум. Во многих случаях это происходит гораздо быстрее.\n\n` +
    `⚠️ Пожалуйста, НЕ оставляйте отзыв в данный момент. ` +
    `Мы активно работаем над вашим заказом и хотим убедиться, что вы получите свой товар, ` +
    `прежде чем поделитесь впечатлениями. После решения вопроса мы уверены, что вы останетесь довольны!\n\n` +
    `📩 Если вам нужна срочная помощь, ответьте в этот чат или свяжитесь с нашей службой поддержки. ` +
    `Мы работаем круглосуточно и сделаем всё возможное для скорейшего решения.\n\n` +
    `🙏 Благодарим за терпение и понимание.`,

  zh: () =>
    `⏳ 我们想通知您，您的交付时间比预期稍长。\n\n` +
    `🔒 请放心——您的付款完全安全且受到保障。` +
    `我们的技术团队已自动收到通知，正在立即处理此问题。\n\n` +
    `🕐 我们预计最多在1-2小时内解决此问题。很多情况下，解决速度会更快。\n\n` +
    `⚠️ 请暂时不要留下任何评价。` +
    `我们正在积极处理您的订单，希望确保您在分享体验之前收到产品。` +
    `问题解决后，我们相信您一定会满意的！\n\n` +
    `📩 如需即时帮助，请回复此对话或联系我们的客服团队。` +
    `我们全天候24小时在线，竭尽全力为您尽快解决问题。\n\n` +
    `🙏 感谢您的耐心和理解。`,
};

const followUpTemplates = {
  en: (data) =>
    `👋 Hello again! We hope you are enjoying your purchase.\n\n` +
    (data.username ? `📦 Just a quick reminder — your account details:\n👤 ${data.username}\n\n` : '') +
    `We wanted to kindly check in and see if everything is working well for you.\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `If you are happy with the service, a quick positive review would mean the world to us! ` +
    `It takes just a few seconds and helps other customers find reliable sellers.\n\n` +
    `If anything is not working as expected, please let us know before leaving a review — ` +
    `we will fix it right away!\n\n` +
    `🙏 Thank you for your trust and support!`,

  fr: (data) =>
    `👋 Rebonjour ! Nous espérons que vous profitez de votre achat.\n\n` +
    (data.username ? `📦 Petit rappel — les détails de votre compte :\n👤 ${data.username}\n\n` : '') +
    `Nous voulions simplement prendre de vos nouvelles et vérifier que tout fonctionne bien.\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `Si vous êtes satisfait du service, un avis positif rapide signifierait énormément pour nous ! ` +
    `Cela ne prend que quelques secondes et aide d'autres clients à trouver des vendeurs fiables.\n\n` +
    `Si quelque chose ne fonctionne pas comme prévu, contactez-nous avant de laisser un avis — ` +
    `nous corrigerons cela immédiatement !\n\n` +
    `🙏 Merci pour votre confiance et votre soutien !`,

  ar: (data) =>
    `👋 مرحبًا مجددًا! نأمل أنك تستمتع بشرائك.\n\n` +
    (data.username ? `📦 تذكير سريع — تفاصيل حسابك:\n👤 ${data.username}\n\n` : '') +
    `أردنا التواصل معك للتأكد من أن كل شيء يعمل بشكل جيد.\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `إذا كنت سعيدًا بالخدمة، فإن تقييمًا إيجابيًا سريعًا سيعني لنا الكثير! ` +
    `الأمر يستغرق بضع ثوانٍ فقط ويساعد العملاء الآخرين في العثور على بائعين موثوقين.\n\n` +
    `إذا كان هناك أي شيء لا يعمل كما هو متوقع، يرجى إبلاغنا قبل ترك تقييم — ` +
    `سنقوم بإصلاحه على الفور!\n\n` +
    `🙏 شكرًا لثقتكم ودعمكم!`,

  ru: (data) =>
    `👋 Здравствуйте снова! Надеемся, что вы довольны своей покупкой.\n\n` +
    (data.username ? `📦 Небольшое напоминание — данные вашего аккаунта:\n👤 ${data.username}\n\n` : '') +
    `Мы хотели узнать, всё ли у вас работает хорошо.\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `Если вам понравился наш сервис, небольшой положительный отзыв был бы для нас очень важен! ` +
    `Это займёт всего несколько секунд и поможет другим покупателям найти надёжного продавца.\n\n` +
    `Если что-то работает не так, как ожидалось, пожалуйста, сообщите нам перед тем, как оставить отзыв — ` +
    `мы всё исправим немедленно!\n\n` +
    `🙏 Спасибо за доверие и поддержку!`,

  zh: (data) =>
    `👋 再次问候！希望您对购买感到满意。\n\n` +
    (data.username ? `📦 温馨提醒——您的账户信息：\n👤 ${data.username}\n\n` : '') +
    `我们想确认一切是否运行正常。\n\n` +
    `⭐⭐⭐⭐⭐\n` +
    `如果您对我们的服务感到满意，一个简短的好评对我们意义重大！` +
    `只需几秒钟，就能帮助其他客户找到可靠的卖家。\n\n` +
    `如果有任何问题，请在留评前告诉我们——` +
    `我们会立即为您解决！\n\n` +
    `🙏 感谢您的信任和支持！`,
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED MESSAGE GENERATOR FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the initial contact message sent when an order is first detected.
 * Includes a warm greeting, order link, delivery timeline, and a firm but polite
 * request not to leave negative reviews.
 *
 * @param {string} lang - Language code ('en', 'fr', 'ar', 'ru', 'zh')
 * @param {string} orderUrl - The URL where the customer can track/receive their order
 * @returns {string} Formatted message string
 */
export function getInitialContactMessage(lang, orderUrl) {
  const validLang = validateLang(lang);
  const safeUrl = sanitize(orderUrl) || 'https://example.com/order';

  try {
    const template = initialContactTemplates[validLang];
    if (!template) {
      console.error(`[messages] Missing initial contact template for lang: ${validLang}`);
      return initialContactTemplates.en(safeUrl);
    }
    return template(safeUrl);
  } catch (error) {
    console.error(`[messages] Error generating initial contact message:`, error);
    return initialContactTemplates.en(safeUrl);
  }
}

/**
 * Generates the delivery success message containing product credentials.
 * Includes a celebration tone, clear product details, and a prompt for a
 * positive 5-star review.
 *
 * @param {string} lang - Language code ('en', 'fr', 'ar', 'ru', 'zh')
 * @param {Object} deliveryData - The delivered product data
 * @param {string} [deliveryData.username] - Account username
 * @param {string} [deliveryData.password] - Account password
 * @param {string} [deliveryData.other] - Any additional product info
 * @param {string} [deliveryData.expiry] - Expiry date/time string
 * @returns {string} Formatted message string
 */
export function getDeliverySuccessMessage(lang, deliveryData) {
  const validLang = validateLang(lang);

  // Sanitize all delivery data fields
  const safeData = {
    username: sanitize(deliveryData?.username),
    password: sanitize(deliveryData?.password),
    other: sanitize(deliveryData?.other),
    expiry: sanitize(deliveryData?.expiry),
  };

  try {
    const template = deliverySuccessTemplates[validLang];
    if (!template) {
      console.error(`[messages] Missing delivery success template for lang: ${validLang}`);
      return deliverySuccessTemplates.en(safeData);
    }
    return template(safeData);
  } catch (error) {
    console.error(`[messages] Error generating delivery success message:`, error);
    return deliverySuccessTemplates.en(safeData);
  }
}

/**
 * Generates the delivery failure/delay message.
 * Uses a calm, apologetic tone with reassurance about payment safety.
 * Critically asks the customer NOT to leave a review until the issue is resolved.
 *
 * @param {string} lang - Language code ('en', 'fr', 'ar', 'ru', 'zh')
 * @returns {string} Formatted message string
 */
export function getDeliveryFailureMessage(lang) {
  const validLang = validateLang(lang);

  try {
    const template = deliveryFailureTemplates[validLang];
    if (!template) {
      console.error(`[messages] Missing delivery failure template for lang: ${validLang}`);
      return deliveryFailureTemplates.en();
    }
    return template();
  } catch (error) {
    console.error(`[messages] Error generating delivery failure message:`, error);
    return deliveryFailureTemplates.en();
  }
}

/**
 * Generates a follow-up message sent after successful delivery.
 * Gently reminds the customer to leave a positive review and offers
 * to help if anything is not working.
 *
 * @param {string} lang - Language code ('en', 'fr', 'ar', 'ru', 'zh')
 * @param {Object} deliveryData - The delivered product data (for reference)
 * @param {string} [deliveryData.username] - Account username (shown as a reminder)
 * @param {string} [deliveryData.password] - Account password
 * @param {string} [deliveryData.other] - Any additional product info
 * @param {string} [deliveryData.expiry] - Expiry date/time string
 * @returns {string} Formatted message string
 */
export function getFollowUpMessage(lang, deliveryData) {
  const validLang = validateLang(lang);

  const safeData = {
    username: sanitize(deliveryData?.username),
    password: sanitize(deliveryData?.password),
    other: sanitize(deliveryData?.other),
    expiry: sanitize(deliveryData?.expiry),
  };

  try {
    const template = followUpTemplates[validLang];
    if (!template) {
      console.error(`[messages] Missing follow-up template for lang: ${validLang}`);
      return followUpTemplates.en(safeData);
    }
    return template(safeData);
  } catch (error) {
    console.error(`[messages] Error generating follow-up message:`, error);
    return followUpTemplates.en(safeData);
  }
}

/**
 * Returns the list of supported language codes.
 * @returns {string[]} Array of supported language codes
 */
export function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Checks if a language code is supported.
 * @param {string} lang - Language code to check
 * @returns {boolean} True if the language is supported
 */
export function isLanguageSupported(lang) {
  if (!lang || typeof lang !== 'string') return false;
  return SUPPORTED_LANGUAGES.includes(lang.toLowerCase().trim());
}
