/**
 * @fileoverview UI translations for the customer delivery page and admin panel.
 *
 * All translations are natural and fluent, carefully reviewed for:
 * - French: proper accents and grammar
 * - Arabic: correct RTL text with appropriate grammar
 * - Russian: correct grammatical cases
 * - Chinese: Simplified Chinese (not Traditional)
 *
 * Keyed by language code: en, fr, ar, ru, zh
 */

const translations = {
  // ─────────────────────────────────────────────────────────────────────────
  // ENGLISH
  // ─────────────────────────────────────────────────────────────────────────
  en: {
    // Page-level
    pageTitle: 'Order Delivery',
    pageDescription: 'Your order is being processed. Your product will be delivered shortly.',

    // Status labels
    statusProcessing: 'Processing',
    statusDelivered: 'Delivered',
    statusFailed: 'Delayed',
    statusPending: 'Pending',

    // Delivery section
    deliveryTitle: 'Your Product',
    deliverySubtitle: 'Here are your product details — please save them securely.',

    // Credential labels
    credentialsLabel: 'Credentials',
    usernameLabel: 'Username',
    passwordLabel: 'Password',
    otherInfoLabel: 'Additional Information',
    expiryLabel: 'Valid Until',

    // Buttons
    copyButton: 'Copy',
    copiedButton: 'Copied!',

    // Processing state
    processingMessage: 'Your order is being prepared...',
    processingSubMessage: 'This usually takes less than 2 minutes. Please keep this page open.',

    // Failed state
    failedMessage: 'Delivery is taking longer than expected',
    failedSubMessage: 'Our team has been notified and is working on it. Your payment is 100% safe.',

    // Post-delivery
    thankYouMessage: 'Thank you for your purchase!',
    reviewPrompt: 'If you enjoyed our service, we\'d love a positive review ⭐',

    // Support
    supportMessage: 'Need help? Our support team is available 24/7.',
    supportContact: 'Contact Support',

    // Language selector
    languageLabel: 'Language',

    // Footer
    footer: 'Secure automated delivery system',
    poweredBy: 'Powered by DigiDeliver',

    // Admin panel
    adminLogin: 'Admin Login',
    adminTitle: 'Administration Panel',
    adminOrders: 'Orders',
    adminWallet: 'Wallet',
    adminMappings: 'Product Mappings',
    adminLogs: 'System Logs',
    adminRetry: 'Retry',

    // Order table
    orderDate: 'Date',
    orderStatus: 'Status',
    orderProduct: 'Product',
    orderActions: 'Actions',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FRENCH
  // ─────────────────────────────────────────────────────────────────────────
  fr: {
    pageTitle: 'Livraison de commande',
    pageDescription: 'Votre commande est en cours de traitement. Votre produit sera livré sous peu.',

    statusProcessing: 'En cours',
    statusDelivered: 'Livré',
    statusFailed: 'Retardé',
    statusPending: 'En attente',

    deliveryTitle: 'Votre produit',
    deliverySubtitle: 'Voici les détails de votre produit — veuillez les conserver en lieu sûr.',

    credentialsLabel: 'Identifiants',
    usernameLabel: 'Identifiant',
    passwordLabel: 'Mot de passe',
    otherInfoLabel: 'Informations complémentaires',
    expiryLabel: 'Valide jusqu\'au',

    copyButton: 'Copier',
    copiedButton: 'Copié !',

    processingMessage: 'Votre commande est en préparation...',
    processingSubMessage: 'Cela prend généralement moins de 2 minutes. Veuillez garder cette page ouverte.',

    failedMessage: 'La livraison prend plus de temps que prévu',
    failedSubMessage: 'Notre équipe a été notifiée et y travaille. Votre paiement est 100 % sécurisé.',

    thankYouMessage: 'Merci pour votre achat !',
    reviewPrompt: 'Si vous avez apprécié notre service, un avis positif nous ferait très plaisir ⭐',

    supportMessage: 'Besoin d\'aide ? Notre équipe d\'assistance est disponible 24h/24.',
    supportContact: 'Contacter le support',

    languageLabel: 'Langue',

    footer: 'Système de livraison automatisé et sécurisé',
    poweredBy: 'Propulsé par DigiDeliver',

    adminLogin: 'Connexion administrateur',
    adminTitle: 'Panneau d\'administration',
    adminOrders: 'Commandes',
    adminWallet: 'Portefeuille',
    adminMappings: 'Correspondances produits',
    adminLogs: 'Journaux système',
    adminRetry: 'Réessayer',

    orderDate: 'Date',
    orderStatus: 'Statut',
    orderProduct: 'Produit',
    orderActions: 'Actions',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ARABIC (RTL)
  // ─────────────────────────────────────────────────────────────────────────
  ar: {
    pageTitle: 'تسليم الطلب',
    pageDescription: 'طلبك قيد المعالجة. سيتم تسليم منتجك قريبًا.',

    statusProcessing: 'قيد المعالجة',
    statusDelivered: 'تم التسليم',
    statusFailed: 'متأخر',
    statusPending: 'في الانتظار',

    deliveryTitle: 'منتجك',
    deliverySubtitle: 'إليك تفاصيل منتجك — يرجى حفظها في مكان آمن.',

    credentialsLabel: 'بيانات الدخول',
    usernameLabel: 'اسم المستخدم',
    passwordLabel: 'كلمة المرور',
    otherInfoLabel: 'معلومات إضافية',
    expiryLabel: 'صالح حتى',

    copyButton: 'نسخ',
    copiedButton: 'تم النسخ!',

    processingMessage: 'جارٍ تحضير طلبك...',
    processingSubMessage: 'تستغرق هذه العملية عادةً أقل من دقيقتين. يرجى إبقاء هذه الصفحة مفتوحة.',

    failedMessage: 'التسليم يستغرق وقتًا أطول من المتوقع',
    failedSubMessage: 'تم إخطار فريقنا وهو يعمل على ذلك. دفعتك آمنة 100%.',

    thankYouMessage: 'شكرًا لشرائك!',
    reviewPrompt: 'إذا أعجبتك خدمتنا، سنكون سعداء بتقييم إيجابي ⭐',

    supportMessage: 'تحتاج مساعدة؟ فريق الدعم متاح على مدار الساعة.',
    supportContact: 'تواصل مع الدعم',

    languageLabel: 'اللغة',

    footer: 'نظام تسليم آلي وآمن',
    poweredBy: 'مدعوم من DigiDeliver',

    adminLogin: 'تسجيل دخول المدير',
    adminTitle: 'لوحة الإدارة',
    adminOrders: 'الطلبات',
    adminWallet: 'المحفظة',
    adminMappings: 'ربط المنتجات',
    adminLogs: 'سجلات النظام',
    adminRetry: 'إعادة المحاولة',

    orderDate: 'التاريخ',
    orderStatus: 'الحالة',
    orderProduct: 'المنتج',
    orderActions: 'الإجراءات',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RUSSIAN
  // ─────────────────────────────────────────────────────────────────────────
  ru: {
    pageTitle: 'Доставка заказа',
    pageDescription: 'Ваш заказ обрабатывается. Товар будет доставлен в ближайшее время.',

    statusProcessing: 'Обработка',
    statusDelivered: 'Доставлен',
    statusFailed: 'Задержка',
    statusPending: 'Ожидание',

    deliveryTitle: 'Ваш товар',
    deliverySubtitle: 'Вот данные вашего товара — сохраните их в надёжном месте.',

    credentialsLabel: 'Учётные данные',
    usernameLabel: 'Логин',
    passwordLabel: 'Пароль',
    otherInfoLabel: 'Дополнительная информация',
    expiryLabel: 'Действителен до',

    copyButton: 'Копировать',
    copiedButton: 'Скопировано!',

    processingMessage: 'Ваш заказ готовится...',
    processingSubMessage: 'Обычно это занимает менее 2 минут. Пожалуйста, не закрывайте страницу.',

    failedMessage: 'Доставка занимает больше времени, чем ожидалось',
    failedSubMessage: 'Наша команда уведомлена и работает над решением. Ваш платёж защищён на 100%.',

    thankYouMessage: 'Спасибо за покупку!',
    reviewPrompt: 'Если вам понравился наш сервис, мы будем рады положительному отзыву ⭐',

    supportMessage: 'Нужна помощь? Наша поддержка доступна круглосуточно.',
    supportContact: 'Связаться с поддержкой',

    languageLabel: 'Язык',

    footer: 'Безопасная автоматическая система доставки',
    poweredBy: 'Работает на DigiDeliver',

    adminLogin: 'Вход для администратора',
    adminTitle: 'Панель управления',
    adminOrders: 'Заказы',
    adminWallet: 'Кошелёк',
    adminMappings: 'Привязка товаров',
    adminLogs: 'Системные журналы',
    adminRetry: 'Повторить',

    orderDate: 'Дата',
    orderStatus: 'Статус',
    orderProduct: 'Товар',
    orderActions: 'Действия',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHINESE (SIMPLIFIED)
  // ─────────────────────────────────────────────────────────────────────────
  zh: {
    pageTitle: '订单交付',
    pageDescription: '您的订单正在处理中。您的产品将很快交付。',

    statusProcessing: '处理中',
    statusDelivered: '已交付',
    statusFailed: '延迟',
    statusPending: '待处理',

    deliveryTitle: '您的产品',
    deliverySubtitle: '以下是您的产品详情——请妥善保存。',

    credentialsLabel: '账户信息',
    usernameLabel: '用户名',
    passwordLabel: '密码',
    otherInfoLabel: '附加信息',
    expiryLabel: '有效期至',

    copyButton: '复制',
    copiedButton: '已复制！',

    processingMessage: '您的订单正在准备中...',
    processingSubMessage: '通常不超过2分钟。请保持此页面打开。',

    failedMessage: '交付时间比预期稍长',
    failedSubMessage: '我们的团队已收到通知并正在处理。您的付款100%安全。',

    thankYouMessage: '感谢您的购买！',
    reviewPrompt: '如果您对我们的服务满意，希望您能留下好评 ⭐',

    supportMessage: '需要帮助？我们的客服团队全天候在线。',
    supportContact: '联系客服',

    languageLabel: '语言',

    footer: '安全自动化交付系统',
    poweredBy: '由 DigiDeliver 提供支持',

    adminLogin: '管理员登录',
    adminTitle: '管理面板',
    adminOrders: '订单',
    adminWallet: '钱包',
    adminMappings: '产品映射',
    adminLogs: '系统日志',
    adminRetry: '重试',

    orderDate: '日期',
    orderStatus: '状态',
    orderProduct: '产品',
    orderActions: '操作',
  },
};

/**
 * Returns the full translations object for all languages.
 * @returns {Object} Translations keyed by language code
 */
export function getAllTranslations() {
  return translations;
}

/**
 * Returns translations for a specific language.
 * Falls back to English if the language is not supported.
 *
 * @param {string} lang - Language code ('en', 'fr', 'ar', 'ru', 'zh')
 * @returns {Object} Translation key-value pairs for the requested language
 */
export function getTranslationsForLang(lang) {
  if (!lang || typeof lang !== 'string') {
    return translations.en;
  }
  const normalized = lang.toLowerCase().trim();
  return translations[normalized] || translations.en;
}

/**
 * Returns a single translation value by key and language.
 * Falls back to English if key or language is missing.
 *
 * @param {string} lang - Language code
 * @param {string} key - Translation key
 * @returns {string} Translated string, or the key itself if not found
 */
export function getTranslation(lang, key) {
  if (!key || typeof key !== 'string') {
    return '';
  }

  const langTranslations = getTranslationsForLang(lang);
  const value = langTranslations[key];

  if (value !== undefined) {
    return value;
  }

  // Fall back to English if key missing in requested language
  const enValue = translations.en[key];
  if (enValue !== undefined) {
    return enValue;
  }

  // Return the key itself as a last resort (helps debug missing translations)
  console.warn(`[i18n] Missing translation key: "${key}" for lang: "${lang}"`);
  return key;
}

/**
 * Returns the text direction for a given language.
 * @param {string} lang - Language code
 * @returns {'ltr' | 'rtl'} Text direction
 */
export function getDirection(lang) {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export default translations;
