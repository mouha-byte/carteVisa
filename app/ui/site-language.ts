export type SiteLanguage = "fr" | "en" | "ar";

export const SITE_LANGUAGE_STORAGE_KEY = "cartevisite.language.v1";
export const SITE_LANGUAGE_EVENT = "cartevisite:language-change";

const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

type LanguageDictionary = Record<string, string>;

type DynamicRule = {
  pattern: RegExp;
  render: (...groups: string[]) => string;
};

const EN_DICTIONARY: LanguageDictionary = {
  "Landing multimedia professionnelle": "Professional multimedia landing",
  "Design simple, dynamique et visuel": "Simple, dynamic and visual design",
  "Design simple, dynamique et visuel pour presenter les entreprises avec des medias dominants. Pensee pour un affichage fluide sur mobile et desktop.": "Simple, dynamic and visual design to showcase companies with dominant media. Built for smooth display on mobile and desktop.",
  "Explorer les entreprises": "Explore companies",
  "Publier mon entreprise": "Publish my company",
  "Responsive mobile et desktop": "Mobile and desktop responsive",
  "Plateforme orientee business: decouvrez les entreprises recentes, les medias dominants et les offres actives sur tous les formats d ecran.": "Business-focused platform: discover recent companies, dominant media and active offers on all screen sizes.",
  "Medias secondaires": "Secondary media",
  "defilement automatique": "auto scrolling",
  "Recherche instantanee": "Instant search",
  "Supprimer les filtres": "Clear filters",
  "Recherche indisponible": "Search unavailable",
  "Donnees chargees partiellement": "Data loaded partially",
  "Chargement des contenus...": "Loading content...",
  "Recherche en cours...": "Searching...",
  "Suggestions: entreprises recentes": "Suggestions: recent companies",
  "Aucun resultat pour ces filtres. Essayez un autre mot cle ou une autre categorie.": "No results for these filters. Try another keyword or category.",
  "Offres actives": "Active jobs",
  "Voir moins": "Show less",
  "Voir plus": "Show more",
  "Aucune offre active pour le moment.": "No active job offers at the moment.",
  "Contrat": "Contract",
  "Ville": "City",
  "Voir entreprise": "View company",
  Postuler: "Apply",
  "Affichage limite a 6 offres. Cliquez sur Voir plus pour afficher toutes les offres.": "Display limited to 6 offers. Click Show more to display all offers.",
  "Affichage limite a 4 offres. Cliquez sur Voir plus pour afficher toutes les offres.": "Display limited to 4 offers. Click Show more to display all offers.",
  "Entreprises par categorie": "Companies by category",
  "Affichage limite a 6 categories. Cliquez sur Voir plus pour tout afficher.": "Display limited to 6 categories. Click Show more to display all categories.",
  "Affichage limite a 4 categories. Cliquez sur Voir plus pour tout afficher.": "Display limited to 4 categories. Click Show more to display all categories.",
  "Decouvrez les entreprises de cette categorie.": "Discover companies in this category.",
  Contact: "Contact",
  "Contact professionnel": "Professional contact",
  "Formulaire business, reseaux sociaux et echanges rapides avec notre equipe.": "Business form, social channels and quick exchanges with our team.",
  "Creation de site": "Website creation",
  "Modeles web et demos live": "Web templates and live demos",
  "Decouvrez des templates modernes multimedia et demandez votre site sur mesure.": "Discover modern multimedia templates and request your custom website.",
  Navigation: "Navigation",
  Categories: "Categories",
  "Page contact": "Contact page",
  "Formation video": "Video training",
  "Retour haut": "Back to top",
  Publicite: "Advertising",
  Recherche: "Search",
  "Creer mon site": "Create my website",
  Formation: "Training",
  "Espace entreprise": "Company space",
  "Espace admin": "Admin area",
  Theme: "Theme",
  Connexion: "Login",
  "Chargement...": "Loading...",
  "Cliquez pour deconnecter": "Click to log out",
  "Basculer le theme clair/sombre": "Toggle light/dark theme",
  "Publications et visibilite d entreprises": "Company publications and visibility",
  "Espace compte": "Account space",
  "Se connecter": "Sign in",
  "Creer un compte": "Create an account",
  "Connectez-vous a votre compte pour gerer votre entreprise et vos candidatures.": "Sign in to your account to manage your company and applications.",
  Email: "Email",
  "Mot de passe": "Password",
  "Pas encore de compte ?": "No account yet?",
  Inscription: "Sign up",
  "Configuration Supabase manquante.": "Missing Supabase configuration.",
  "Connexion invalide.": "Invalid login.",
  "Session invalide recue depuis le serveur auth.": "Invalid session received from auth server.",
  "Connexion reussie. Redirection...": "Login successful. Redirecting...",
  "Erreur reseau. Reessayez dans quelques instants.": "Network error. Try again in a moment.",
  "Nom complet": "Full name",
  "Mot de passe (min 8 caracteres)": "Password (min 8 characters)",
  "Confirmer le mot de passe": "Confirm password",
  "Creer mon compte": "Create my account",
  "Compte cree et connecte. Redirection...": "Account created and signed in. Redirecting...",
  "Compte cree. Verifiez votre email pour activer votre acces, puis connectez-vous.": "Account created. Check your email to activate your access, then sign in.",
  "Le mot de passe doit contenir au moins 8 caracteres.": "Password must contain at least 8 characters.",
  "La confirmation du mot de passe ne correspond pas.": "Password confirmation does not match.",
  "Inscription...": "Signing up...",
  "Deja un compte ?": "Already have an account?",
  Candidature: "Application",
  "Envoyez votre candidature avec CV et lettre de motivation.": "Send your application with CV and cover letter.",
  "Parlons de votre croissance digitale et de vos besoins entreprise.": "Let's discuss your digital growth and business needs.",
  "Candidature en cours": "Application in progress",
  "Voir la page de l entreprise": "View company page",
  "Reseaux et canaux directs": "Networks and direct channels",
  "Choisissez le canal adapte a votre besoin: partenariat, assistance, ou demande commerciale.": "Choose the channel adapted to your need: partnership, support, or business request.",
  "Email direct": "Direct email",
  "Envoyer ma candidature": "Send my application",
  "Envoyer un message": "Send a message",
  "Ajoutez votre CV, votre lettre de motivation et vos coordonnees.": "Add your CV, cover letter and contact details.",
  "Formulaire rapide avec envoi vers l API contact pour traitement immediat.": "Quick form sent to the contact API for immediate processing.",
  "Email professionnel": "Professional email",
  "Le CV est obligatoire pour envoyer votre candidature.": "CV is required to submit your application.",
  "La lettre de motivation est obligatoire pour envoyer votre candidature.": "Cover letter is required to submit your application.",
  "Votre candidature a ete envoyee avec succes. Nous vous contacterons rapidement.": "Your application was sent successfully. We will contact you shortly.",
  "Votre message a ete envoye avec succes. Notre equipe vous repondra rapidement.": "Your message was sent successfully. Our team will reply quickly.",
  "Une erreur inattendue est survenue. Merci de reessayer dans un instant.": "An unexpected error occurred. Please try again in a moment.",
  "Erreur reseau. Verifiez votre connexion.": "Network error. Check your connection.",
  "Partenariats B2B et opportunites entreprise": "B2B partnerships and business opportunities",
  "News visuelles, reels et promotions": "Visual news, reels and promotions",
  "Communautes locales et campagnes social media": "Local communities and social media campaigns",
  "Formation video et demos marketing": "Video training and marketing demos",
  "Creation de site web": "Website creation",
  "Une page complete avec modeles professionnels, photos, videos et liens live.": "A complete page with professional templates, photos, videos and live links.",
  "Choisissez un modele, inspirez-vous des references visuelles, et envoyez votre brief pour lancer votre nouveau site rapidement.": "Choose a template, get inspired by visual references, and send your brief to launch your new website quickly.",
  "Demande de creation": "Creation request",
  "Ce formulaire envoie une demande complete a l API de creation de site.": "This form sends a complete request to the website creation API.",
  "Nom entreprise": "Company name",
  "Secteur (optionnel)": "Sector (optional)",
  "Votre demande de creation de site a ete envoyee. Notre equipe vous recontacte rapidement.": "Your website creation request has been sent. Our team will contact you quickly.",
  Categorie: "Category",
  "Rechercher une entreprise dans cette categorie": "Search for a company in this category",
  "Entreprises de la categorie": "Companies in this category",
  "Entreprises recentes": "Recent companies",
  "Fiche entreprise": "Company profile",
  "Chargement de la fiche entreprise...": "Loading company profile...",
  "Secteur non specifie": "Sector not specified",
  "Ville non specifiee": "City not specified",
  "Acces reserve aux comptes entreprise.": "Access restricted to company accounts.",
  "Acces reserve au super administrateur.": "Access restricted to super administrator.",
  "Reponse API invalide.": "Invalid API response.",
  "Reponse non JSON pour": "Non-JSON response for",
  "Profil entreprise mis a jour.": "Company profile updated.",
  Entreprise: "Company",
  Offre: "Offer",
  Service: "Service",
  Tout: "All",
  "Toutes categories": "All categories",
  "Toutes villes": "All cities",
  "Mot cle: entreprise, service, offre, produit": "Keyword: company, service, offer, product",
  Ouvrir: "Open",
};

const AR_DICTIONARY: LanguageDictionary = {
  "Landing multimedia professionnelle": "واجهة هبوط احترافية متعددة الوسائط",
  "Design simple, dynamique et visuel": "تصميم بسيط وديناميكي وبصري",
  "Design simple, dynamique et visuel pour presenter les entreprises avec des medias dominants. Pensee pour un affichage fluide sur mobile et desktop.": "تصميم بسيط وديناميكي وبصري لعرض الشركات بوسائط قوية، ومهيأ لعرض سلس على الجوال وسطح المكتب.",
  "Explorer les entreprises": "استكشف الشركات",
  "Publier mon entreprise": "انشر شركتي",
  "Responsive mobile et desktop": "متجاوب للجوال وسطح المكتب",
  "Plateforme orientee business: decouvrez les entreprises recentes, les medias dominants et les offres actives sur tous les formats d ecran.": "منصة موجهة للأعمال: اكتشف الشركات الحديثة والوسائط البارزة والعروض النشطة على جميع أحجام الشاشات.",
  "Medias secondaires": "وسائط ثانوية",
  "defilement automatique": "تمرير تلقائي",
  "Recherche instantanee": "بحث فوري",
  "Supprimer les filtres": "مسح الفلاتر",
  "Recherche indisponible": "البحث غير متاح",
  "Donnees chargees partiellement": "تم تحميل البيانات جزئيا",
  "Chargement des contenus...": "جاري تحميل المحتوى...",
  "Recherche en cours...": "جاري البحث...",
  "Suggestions: entreprises recentes": "اقتراحات: شركات حديثة",
  "Aucun resultat pour ces filtres. Essayez un autre mot cle ou une autre categorie.": "لا توجد نتائج لهذه الفلاتر. جرّب كلمة مفتاحية أو فئة أخرى.",
  "Offres actives": "عروض نشطة",
  "Voir moins": "عرض أقل",
  "Voir plus": "عرض المزيد",
  "Aucune offre active pour le moment.": "لا توجد عروض نشطة حاليا.",
  Contrat: "عقد",
  Ville: "المدينة",
  "Voir entreprise": "عرض الشركة",
  Postuler: "قدّم الآن",
  "Affichage limite a 6 offres. Cliquez sur Voir plus pour afficher toutes les offres.": "العرض محدود بـ 6 عروض. انقر على عرض المزيد لإظهار كل العروض.",
  "Affichage limite a 4 offres. Cliquez sur Voir plus pour afficher toutes les offres.": "العرض محدود بـ 4 عروض. انقر على عرض المزيد لإظهار كل العروض.",
  "Entreprises par categorie": "الشركات حسب الفئة",
  "Affichage limite a 6 categories. Cliquez sur Voir plus pour tout afficher.": "العرض محدود بـ 6 فئات. انقر على عرض المزيد لإظهار الكل.",
  "Affichage limite a 4 categories. Cliquez sur Voir plus pour tout afficher.": "العرض محدود بـ 4 فئات. انقر على عرض المزيد لإظهار الكل.",
  "Decouvrez les entreprises de cette categorie.": "اكتشف شركات هذه الفئة.",
  Contact: "اتصال",
  "Contact professionnel": "اتصال احترافي",
  "Formulaire business, reseaux sociaux et echanges rapides avec notre equipe.": "نموذج أعمال وقنوات اجتماعية وتواصل سريع مع فريقنا.",
  "Creation de site": "إنشاء موقع",
  "Modeles web et demos live": "قوالب ويب وعروض مباشرة",
  "Decouvrez des templates modernes multimedia et demandez votre site sur mesure.": "اكتشف قوالب حديثة متعددة الوسائط واطلب موقعك المخصص.",
  Navigation: "التنقل",
  Categories: "الفئات",
  "Page contact": "صفحة الاتصال",
  "Formation video": "تدريب فيديو",
  "Retour haut": "العودة للأعلى",
  Publicite: "إعلانات",
  Recherche: "بحث",
  "Creer mon site": "أنشئ موقعي",
  Formation: "تدريب",
  "Espace entreprise": "مساحة الشركة",
  "Espace admin": "مساحة الإدارة",
  Theme: "المظهر",
  Connexion: "تسجيل الدخول",
  "Chargement...": "جاري التحميل...",
  "Cliquez pour deconnecter": "انقر لتسجيل الخروج",
  "Basculer le theme clair/sombre": "تبديل الوضع الفاتح/الداكن",
  "Publications et visibilite d entreprises": "منشورات ورؤية الشركات",
  "Espace compte": "مساحة الحساب",
  "Se connecter": "دخول",
  "Creer un compte": "إنشاء حساب",
  "Connectez-vous a votre compte pour gerer votre entreprise et vos candidatures.": "سجّل الدخول إلى حسابك لإدارة شركتك وطلباتك.",
  Email: "البريد الإلكتروني",
  "Mot de passe": "كلمة المرور",
  "Pas encore de compte ?": "ليس لديك حساب بعد؟",
  Inscription: "تسجيل",
  "Configuration Supabase manquante.": "إعدادات Supabase مفقودة.",
  "Connexion invalide.": "بيانات الدخول غير صحيحة.",
  "Session invalide recue depuis le serveur auth.": "تم استلام جلسة غير صالحة من خادم المصادقة.",
  "Connexion reussie. Redirection...": "تم تسجيل الدخول بنجاح. جارٍ التحويل...",
  "Erreur reseau. Reessayez dans quelques instants.": "خطأ في الشبكة. حاول مرة أخرى بعد قليل.",
  "Nom complet": "الاسم الكامل",
  "Mot de passe (min 8 caracteres)": "كلمة المرور (8 أحرف على الأقل)",
  "Confirmer le mot de passe": "تأكيد كلمة المرور",
  "Creer mon compte": "إنشاء حسابي",
  "Compte cree et connecte. Redirection...": "تم إنشاء الحساب وتسجيل الدخول. جارٍ التحويل...",
  "Compte cree. Verifiez votre email pour activer votre acces, puis connectez-vous.": "تم إنشاء الحساب. تحقق من بريدك لتفعيل الوصول ثم سجّل الدخول.",
  "Le mot de passe doit contenir au moins 8 caracteres.": "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.",
  "La confirmation du mot de passe ne correspond pas.": "تأكيد كلمة المرور غير مطابق.",
  "Inscription...": "جاري التسجيل...",
  "Deja un compte ?": "لديك حساب بالفعل؟",
  Candidature: "طلب ترشيح",
  "Envoyez votre candidature avec CV et lettre de motivation.": "أرسل طلبك مع السيرة الذاتية وخطاب التحفيز.",
  "Parlons de votre croissance digitale et de vos besoins entreprise.": "دعنا نتحدث عن نموك الرقمي واحتياجات عملك.",
  "Candidature en cours": "طلب قيد المعالجة",
  "Voir la page de l entreprise": "عرض صفحة الشركة",
  "Reseaux et canaux directs": "الشبكات والقنوات المباشرة",
  "Choisissez le canal adapte a votre besoin: partenariat, assistance, ou demande commerciale.": "اختر القناة المناسبة لاحتياجك: شراكة أو دعم أو طلب تجاري.",
  "Email direct": "بريد مباشر",
  "Envoyer ma candidature": "إرسال طلبي",
  "Envoyer un message": "إرسال رسالة",
  "Ajoutez votre CV, votre lettre de motivation et vos coordonnees.": "أضف سيرتك الذاتية وخطاب التحفيز وبيانات التواصل.",
  "Formulaire rapide avec envoi vers l API contact pour traitement immediat.": "نموذج سريع يُرسل إلى واجهة الاتصال للمعالجة الفورية.",
  "Email professionnel": "بريد مهني",
  "Le CV est obligatoire pour envoyer votre candidature.": "السيرة الذاتية مطلوبة لإرسال الطلب.",
  "La lettre de motivation est obligatoire pour envoyer votre candidature.": "خطاب التحفيز مطلوب لإرسال الطلب.",
  "Votre candidature a ete envoyee avec succes. Nous vous contacterons rapidement.": "تم إرسال طلبك بنجاح. سنتواصل معك قريبا.",
  "Votre message a ete envoye avec succes. Notre equipe vous repondra rapidement.": "تم إرسال رسالتك بنجاح. سيرد عليك فريقنا بسرعة.",
  "Une erreur inattendue est survenue. Merci de reessayer dans un instant.": "حدث خطأ غير متوقع. يرجى المحاولة بعد قليل.",
  "Erreur reseau. Verifiez votre connexion.": "خطأ في الشبكة. تحقق من اتصالك.",
  "Partenariats B2B et opportunites entreprise": "شراكات الأعمال وفرص الشركات",
  "News visuelles, reels et promotions": "أخبار بصرية ومقاطع ترويجية",
  "Communautes locales et campagnes social media": "مجتمعات محلية وحملات التواصل الاجتماعي",
  "Formation video et demos marketing": "تدريب فيديو وعروض تسويقية",
  "Creation de site web": "إنشاء موقع ويب",
  "Une page complete avec modeles professionnels, photos, videos et liens live.": "صفحة كاملة بقوالب احترافية وصور وفيديو وروابط مباشرة.",
  "Choisissez un modele, inspirez-vous des references visuelles, et envoyez votre brief pour lancer votre nouveau site rapidement.": "اختر قالبا، استلهم من المراجع البصرية، وأرسل موجزك لإطلاق موقعك بسرعة.",
  "Demande de creation": "طلب إنشاء",
  "Ce formulaire envoie une demande complete a l API de creation de site.": "هذا النموذج يرسل طلبا كاملا إلى واجهة إنشاء المواقع.",
  "Nom entreprise": "اسم الشركة",
  "Secteur (optionnel)": "القطاع (اختياري)",
  "Votre demande de creation de site a ete envoyee. Notre equipe vous recontacte rapidement.": "تم إرسال طلب إنشاء الموقع. سيتواصل فريقنا معك بسرعة.",
  Categorie: "الفئة",
  "Rechercher une entreprise dans cette categorie": "ابحث عن شركة ضمن هذه الفئة",
  "Entreprises de la categorie": "شركات هذه الفئة",
  "Entreprises recentes": "شركات حديثة",
  "Fiche entreprise": "ملف الشركة",
  "Chargement de la fiche entreprise...": "جاري تحميل ملف الشركة...",
  "Secteur non specifie": "القطاع غير محدد",
  "Ville non specifiee": "المدينة غير محددة",
  "Acces reserve aux comptes entreprise.": "الوصول مخصص لحسابات الشركات.",
  "Acces reserve au super administrateur.": "الوصول مخصص للمشرف الأعلى.",
  "Reponse API invalide.": "استجابة API غير صالحة.",
  "Reponse non JSON pour": "استجابة ليست JSON للمسار",
  "Profil entreprise mis a jour.": "تم تحديث ملف الشركة.",
  Entreprise: "شركة",
  Offre: "عرض",
  Service: "خدمة",
  Tout: "الكل",
  "Toutes categories": "كل الفئات",
  "Toutes villes": "كل المدن",
  "Mot cle: entreprise, service, offre, produit": "كلمة مفتاحية: شركة، خدمة، عرض، منتج",
  Ouvrir: "فتح",
};

const EN_EXTRA_DICTIONARY: LanguageDictionary = {
  "Pack Visibilite Premium": "Premium Visibility Pack",
  "Mettez votre entreprise en avant des le premier ecran.": "Put your company in the spotlight from the first screen.",
  "Boost Recrutement": "Recruitment Boost",
  "Recevez plus de candidatures qualifiees en quelques jours.": "Receive more qualified applications in a few days.",
  "Formation Business": "Business Training",
  "Sessions gratuites et payantes pour entrepreneurs.": "Free and paid sessions for entrepreneurs.",
  "Creation Site Web": "Website Creation",
  "Lancez votre site pro avec notre equipe design + dev.": "Launch your professional website with our design + dev team.",
  "Video Branding": "Video Branding",
  "Faites passer votre image de marque au niveau superieur.": "Take your brand image to the next level.",
  "Creez votre compte pour publier votre entreprise et suivre vos candidatures.": "Create your account to publish your company and track your applications.",
  "Inscription impossible.": "Signup failed.",
  "Chargement de l espace super admin...": "Loading super admin area...",
  "Compte societe cree avec succes.": "Company account created successfully.",
  "Societe mise a jour.": "Company updated.",
  "Societe supprimee.": "Company deleted.",
  "Creer un compte societe": "Create a company account",
  "Creer la societe": "Create company",
  "Creation...": "Creating...",
  "Corporate Executive": "Corporate Executive",
  "Site institutionnel premium avec forte credibilite visuelle.": "Premium corporate website with strong visual credibility.",
  "Startup Momentum": "Startup Momentum",
  "Landing conversion orientee acquisition et campagnes ads.": "Conversion-focused landing page for acquisition and ad campaigns.",
  "Agency Visual Pro": "Agency Visual Pro",
  "Portfolio agence avec animations, videos et galerie projets.": "Agency portfolio with animations, videos and project gallery.",
  "Ecommerce Flash": "Ecommerce Flash",
  "Boutique orientee performance mobile et conversion checkout.": "Store focused on mobile performance and checkout conversion.",
  "SaaS Dashboard Live": "SaaS Dashboard Live",
  "Interface SaaS complete avec tableaux de bord, analytics et espaces membres.": "Complete SaaS interface with dashboards, analytics and member areas.",
  "Portfolio Agency Live": "Portfolio Agency Live",
  "Showcase agence avec sections services, etudes de cas et contact conversion.": "Agency showcase with services, case studies and conversion-focused contact.",
  "Ecommerce Boutique Live": "Ecommerce Boutique Live",
  "Boutique moderne orientee mobile-first et tunnel de conversion optimise.": "Modern mobile-first store with optimized conversion funnel.",
  "Landing Campagne Live": "Campaign Landing Live",
  "Landing marketing conversion avec hero impactant, FAQ et CTA multi-niveaux.": "Marketing conversion landing with impactful hero, FAQ and multi-level CTAs.",
  "Autres sites live": "Other live websites",
  references: "references",
  "Ouvrir le live": "Open live demo",
  "Nom du contact": "Contact name",
  "Telephone (optionnel)": "Phone (optional)",
  "Decrivez votre projet, style, pages, objectifs et delais": "Describe your project, style, pages, goals and timeline",
  "Ce formulaire envoie votre dossier directement a notre API de candidatures pour un traitement rapide.": "This form sends your file directly to our applications API for fast processing.",
  "Une page dediee pour centraliser vos demandes, vos informations, et un formulaire clair qui envoie votre message directement par email via notre API.": "A dedicated page to centralize your requests and information, with a clear form that sends your message directly by email through our API.",
  "Envoi...": "Sending...",
  "Envoyer la demande": "Send request",
  "Une erreur inattendue est survenue. Merci de reessayer.": "An unexpected error occurred. Please try again.",
  "Aucune entreprise trouvee pour cette recherche.": "No company found for this search.",
  "Description complete": "Full description",
  Rechercher: "Search",
  "Cette entreprise n a pas encore publie de description detaillee.": "This company has not published a detailed description yet.",
  Adresse: "Address",
  "Non precisee": "Not specified",
  Telephone: "Phone",
  "Non precise": "Not specified",
  "Site web": "Website",
  "Reseaux sociaux": "Social media",
  "Localisation (Google Maps)": "Location (Google Maps)",
  "Carte entreprise": "Company map",
  "Produits / Services": "Products / Services",
  "Aucun service publie pour le moment.": "No services published at the moment.",
  "Service professionnel.": "Professional service.",
  "Sur devis": "On quotation",
  "Demander ce service": "Request this service",
  "Actualites entreprise": "Company news",
  "Aucune actualite pour le moment.": "No news at the moment.",
  "Aucun poste ouvert pour le moment.": "No open position at the moment.",
  "Galerie photos": "Photo gallery",
  "Media entreprise": "Company media",
  "Postes ouverts": "Open positions",
  "Retour dashboard": "Back to dashboard",
  Deconnexion: "Log out",
  "Toutes les entreprises": "All companies",
  "Toutes les candidatures": "All applications",
  "Connecte en tant que": "Logged in as",
  "Liste complete des entreprises (": "Complete list of companies (",
  "Aucune entreprise disponible.": "No company available.",
  "Aucune donnee admin trouvee. Verifiez le seed de la base ou la variable SUPABASE_SERVICE_ROLE_KEY.": "No admin data found. Check your database seed or the SUPABASE_SERVICE_ROLE_KEY variable.",
  "Aucune candidature disponible.": "No application available.",
  "Aucun CV disponible pour cette candidature.": "No CV available for this application.",
  "CV ouvert dans un nouvel onglet.": "CV opened in a new tab.",
  "Aucun fichier de lettre de motivation disponible.": "No cover letter file available.",
  "Lettre de motivation ouverte dans un nouvel onglet.": "Cover letter opened in a new tab.",
  "Acces refuse": "Access denied",
  "Votre compte entreprise n est pas encore lie a une fiche societe. L administrateur doit creer et affecter le compte.": "Your company account is not linked to a company profile yet. An administrator must create and assign it.",
  "Chargement de l espace entreprise...": "Loading company workspace...",
  "Ouvrir l espace super admin": "Open super admin space",
  "Nombre total:": "Total:",
  "Societe inconnue": "Unknown company",
  "Offre inconnue": "Unknown offer",
  "Recue le": "Received on",
  "fichier non nomme": "unnamed file",
  "Aucun texte de motivation.": "No cover letter text.",
  "Lettre de motivation (texte)": "Cover letter (text)",
  "Fichier lettre:": "Letter file:",
  "Ouverture...": "Opening...",
  "Ouvrir CV": "Open CV",
  "CV indisponible": "CV unavailable",
  "Ouvrir lettre motivation": "Open cover letter",
  "Fichier indisponible": "File unavailable",
  "Chargement des candidatures...": "Loading applications...",
  "Chargement de la liste...": "Loading list...",
  "Offres total": "Total offers",
  "Offres publiees": "Published offers",
  "Candidatures en attente": "Pending applications",
  "Chargement des donnees...": "Loading data...",
  "Profil entreprise": "Company profile",
  "Statut actuel:": "Current status:",
  "Type:": "Type:",
  Type: "Type",
  SARL: "SARL",
  Startup: "Startup",
  "slug-entreprise": "company-slug",
  Secteur: "Sector",
  Pays: "Country",
  "Site web (https://...)": "Website (https://...)",
  "Logo URL": "Logo URL",
  "Cover URL": "Cover URL",
  Description: "Description",
  "Enregistrement...": "Saving...",
  "Mettre a jour le profil": "Update profile",
  "Pilotage de votre entreprise": "Manage your company",
  "Modifier une offre": "Edit a job offer",
  "Creer une offre": "Create a job offer",
  "Annuler la modification": "Cancel edit",
  "Sauvegarde...": "Saving...",
  "Sauver statut": "Save status",
  "Ouvrir la page publique": "Open public page",
  "Aucune description fournie.": "No description provided.",
  "Creee le": "Created on",
  "Mise a jour le": "Updated on",
  "Secteur:": "Sector:",
  "Ville:": "City:",
  "Pays:": "Country:",
  "Featured:": "Featured:",
  Oui: "Yes",
  Non: "No",
  "Super admin": "Super admin",
  "Open Live": "Open Live",
  "Services professionnels": "Professional services",
  "Decouvrez nos expertises et choisissez la formule qui correspond a votre besoin. Cette page centralise les informations essentielles et un formulaire rapide pour demander un accompagnement.": "Discover our expertise and choose the package that fits your needs. This page centralizes key information and a fast form to request support.",
  "Nos prestations": "Our services",
  "Strategie et conseil": "Strategy and consulting",
  "Transformation digitale": "Digital transformation",
  "Marketing et communication": "Marketing and communication",
  "Formation et accompagnement": "Training and support",
  "Diagnostic business, priorites claires et feuille de route realiste.": "Business diagnosis, clear priorities and realistic roadmap.",
  "Optimisation de vos processus pour gagner en productivite et en qualite.": "Process optimization to improve productivity and quality.",
  "Positionnement, visibilite et acquisition clients sur les canaux utiles.": "Positioning, visibility and customer acquisition on the right channels.",
  "Montez en competence avec un cadre pratique adapte a votre equipe.": "Upskill with a practical framework adapted to your team.",
  "Audit complet de votre activite": "Complete audit of your activity",
  "Plan d action concret sur 90 jours": "Concrete 90-day action plan",
  "Suivi de performance avec indicateurs": "Performance tracking with KPIs",
  "Cartographie des processus internes": "Internal process mapping",
  "Automatisation des taches repetitives": "Automation of repetitive tasks",
  "Mise en place de tableaux de pilotage": "Setup of management dashboards",
  "Clarification de l offre et du message": "Offer and message clarification",
  "Campagnes digitales ciblees": "Targeted digital campaigns",
  "Suivi des leads et taux de conversion": "Lead tracking and conversion rate monitoring",
  "Parcours de formation metier": "Role-focused training path",
  "Coaching operationnel des equipes": "Operational coaching for teams",
  "Methode simple de progression continue": "Simple method for continuous improvement",
  "Comment ca marche": "How it works",
  "Un process simple pour aller vite et obtenir une reponse claire.": "A simple process to move fast and get a clear answer.",
  "01 Analyse du besoin": "01 Needs analysis",
  "Nous comprenons votre contexte, vos objectifs et vos contraintes.": "We understand your context, goals and constraints.",
  "02 Proposition detaillee": "02 Detailed proposal",
  "Vous recevez une proposition avec plan, delais et resultat attendu.": "You receive a proposal with plan, timeline and expected outcome.",
  "03 Lancement accompagne": "03 Guided launch",
  "Nous executons avec un suivi regulier jusqu aux livrables.": "We execute with regular follow-up through delivery.",
  "Demander plus d informations": "Request more information",
  "Choisissez le service qui vous interesse et envoyez votre demande en quelques secondes.": "Choose the service you are interested in and send your request in seconds.",
  "Choisir un service": "Choose a service",
  "Objectif principal (optionnel)": "Main objective (optional)",
  "Decrivez votre besoin, votre contexte et le resultat attendu": "Describe your need, your context and the expected outcome",
  "Envoyer la demande de service": "Send service request",
  "Etudes de marche et analyse concurrentielle": "Market studies and competitive analysis",
  "Lecture claire du marche pour mieux positionner votre offre.": "Clear market reading to better position your offer.",
  "Sondages terrain et entretiens clients": "Field surveys and customer interviews",
  "Analyse concurrence et signaux prix": "Competitor analysis and pricing signals",
  "Recommandations actionnables pour la croissance": "Actionable recommendations for growth",
  "Organisation d evenements professionnels": "Professional event organization",
  "Conferences, forums et rencontres B2B pour accelerer vos opportunites.": "Conferences, forums and B2B meetings to accelerate your opportunities.",
  "Planification logistique de A a Z": "End-to-end logistics planning",
  "Coordination des intervenants et partenaires": "Coordination of speakers and partners",
  "Mesure d impact et rapport post-evenement": "Impact measurement and post-event reporting",
  "Questions frequentes": "Frequently asked questions",
  "Quelle est la duree moyenne d un accompagnement ?": "What is the average duration of support?",
  "Selon votre besoin: de 1 semaine pour un audit rapide a 3 mois pour un programme complet.": "Depending on your needs: from 1 week for a quick audit to 3 months for a complete program.",
  "Proposez-vous un suivi apres la mission ?": "Do you offer follow-up after the mission?",
  "Oui, nous pouvons mettre en place un suivi mensuel avec indicateurs et ajustements.": "Yes, we can set up monthly follow-up with indicators and adjustments.",
  "Comment est calcule le tarif ?": "How is pricing calculated?",
  "Le tarif depend du perimetre, du niveau d expertise mobilise et du delai demande.": "Pricing depends on scope, expertise level, and requested timeline.",
  "Verification anti-spam": "Anti-spam verification",
  "Calculez:": "Calculate:",
  "Votre reponse": "Your answer",
  "Actualiser": "Refresh",
  "Verification anti-spam invalide. Merci de recalculer la somme.": "Invalid anti-spam verification. Please recalculate the sum.",
};

const AR_EXTRA_DICTIONARY: LanguageDictionary = {
  "Pack Visibilite Premium": "باقة الظهور المميز",
  "Mettez votre entreprise en avant des le premier ecran.": "اجعل شركتك بارزة من الشاشة الأولى.",
  "Boost Recrutement": "تعزيز التوظيف",
  "Recevez plus de candidatures qualifiees en quelques jours.": "احصل على طلبات أكثر جودة خلال أيام قليلة.",
  "Formation Business": "تدريب الأعمال",
  "Sessions gratuites et payantes pour entrepreneurs.": "جلسات مجانية ومدفوعة لرواد الأعمال.",
  "Creation Site Web": "إنشاء موقع ويب",
  "Lancez votre site pro avec notre equipe design + dev.": "أطلق موقعك الاحترافي مع فريق التصميم والتطوير لدينا.",
  "Video Branding": "الهوية بالفيديو",
  "Faites passer votre image de marque au niveau superieur.": "ارتقِ بصورة علامتك التجارية إلى مستوى أعلى.",
  "Creez votre compte pour publier votre entreprise et suivre vos candidatures.": "أنشئ حسابك لنشر شركتك ومتابعة طلباتك.",
  "Inscription impossible.": "تعذر إنشاء الحساب.",
  "Chargement de l espace super admin...": "جارٍ تحميل مساحة المشرف الأعلى...",
  "Compte societe cree avec succes.": "تم إنشاء حساب الشركة بنجاح.",
  "Societe mise a jour.": "تم تحديث الشركة.",
  "Societe supprimee.": "تم حذف الشركة.",
  "Creer un compte societe": "إنشاء حساب شركة",
  "Creer la societe": "إنشاء الشركة",
  "Creation...": "جارٍ الإنشاء...",
  "Corporate Executive": "تنفيذي للشركات",
  "Site institutionnel premium avec forte credibilite visuelle.": "موقع مؤسسي مميز بمصداقية بصرية عالية.",
  "Startup Momentum": "زخم الشركات الناشئة",
  "Landing conversion orientee acquisition et campagnes ads.": "صفحة هبوط موجهة للتحويل واكتساب العملاء وحملات الإعلانات.",
  "Agency Visual Pro": "وكالة بصرية احترافية",
  "Portfolio agence avec animations, videos et galerie projets.": "معرض وكالة مع حركات وفيديو ومعرض مشاريع.",
  "Ecommerce Flash": "متجر إلكتروني سريع",
  "Boutique orientee performance mobile et conversion checkout.": "متجر موجه لأداء الجوال وتحويلات صفحة الدفع.",
  "SaaS Dashboard Live": "لوحة SaaS مباشرة",
  "Interface SaaS complete avec tableaux de bord, analytics et espaces membres.": "واجهة SaaS كاملة مع لوحات تحكم وتحليلات ومساحات للأعضاء.",
  "Portfolio Agency Live": "معرض وكالة مباشر",
  "Showcase agence avec sections services, etudes de cas et contact conversion.": "عرض وكالة مع أقسام خدمات ودراسات حالة وتواصل موجه للتحويل.",
  "Ecommerce Boutique Live": "متجر إلكتروني مباشر",
  "Boutique moderne orientee mobile-first et tunnel de conversion optimise.": "متجر حديث بأسلوب الجوال أولًا ومسار تحويل محسّن.",
  "Landing Campagne Live": "صفحة حملة مباشرة",
  "Landing marketing conversion avec hero impactant, FAQ et CTA multi-niveaux.": "صفحة تسويقية للتحويل مع واجهة قوية وأسئلة شائعة ودعوات متعددة.",
  "Autres sites live": "مواقع مباشرة أخرى",
  references: "مراجع",
  "Ouvrir le live": "فتح العرض المباشر",
  "Nom du contact": "اسم جهة الاتصال",
  "Telephone (optionnel)": "الهاتف (اختياري)",
  "Decrivez votre projet, style, pages, objectifs et delais": "صف مشروعك والأسلوب والصفحات والأهداف والجدول الزمني",
  "Ce formulaire envoie votre dossier directement a notre API de candidatures pour un traitement rapide.": "يرسل هذا النموذج ملفك مباشرة إلى واجهة طلبات التوظيف لمعالجة سريعة.",
  "Une page dediee pour centraliser vos demandes, vos informations, et un formulaire clair qui envoie votre message directement par email via notre API.": "صفحة مخصصة لتجميع طلباتك ومعلوماتك، مع نموذج واضح يرسل رسالتك مباشرة عبر البريد من خلال واجهتنا.",
  "Envoi...": "جارٍ الإرسال...",
  "Envoyer la demande": "إرسال الطلب",
  "Une erreur inattendue est survenue. Merci de reessayer.": "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
  "Aucune entreprise trouvee pour cette recherche.": "لم يتم العثور على شركة لهذا البحث.",
  "Description complete": "الوصف الكامل",
  Rechercher: "بحث",
  "Cette entreprise n a pas encore publie de description detaillee.": "هذه الشركة لم تنشر وصفًا تفصيليًا بعد.",
  Adresse: "العنوان",
  "Non precisee": "غير محدد",
  Telephone: "الهاتف",
  "Non precise": "غير محدد",
  "Site web": "الموقع الإلكتروني",
  "Reseaux sociaux": "الشبكات الاجتماعية",
  "Localisation (Google Maps)": "الموقع (خرائط Google)",
  "Carte entreprise": "خريطة الشركة",
  "Produits / Services": "المنتجات / الخدمات",
  "Aucun service publie pour le moment.": "لا توجد خدمات منشورة حاليًا.",
  "Service professionnel.": "خدمة احترافية.",
  "Sur devis": "حسب عرض السعر",
  "Demander ce service": "طلب هذه الخدمة",
  "Actualites entreprise": "أخبار الشركة",
  "Aucune actualite pour le moment.": "لا توجد أخبار حاليًا.",
  "Aucun poste ouvert pour le moment.": "لا توجد وظائف مفتوحة حاليًا.",
  "Galerie photos": "معرض الصور",
  "Media entreprise": "وسائط الشركة",
  "Postes ouverts": "وظائف مفتوحة",
  "Retour dashboard": "العودة إلى لوحة التحكم",
  Deconnexion: "تسجيل الخروج",
  "Toutes les entreprises": "كل الشركات",
  "Toutes les candidatures": "كل الطلبات",
  "Connecte en tant que": "متصل باسم",
  "Liste complete des entreprises (": "القائمة الكاملة للشركات (",
  "Aucune entreprise disponible.": "لا توجد شركة متاحة.",
  "Aucune donnee admin trouvee. Verifiez le seed de la base ou la variable SUPABASE_SERVICE_ROLE_KEY.": "لم يتم العثور على بيانات الإدارة. تحقق من تهيئة البيانات أو من متغير SUPABASE_SERVICE_ROLE_KEY.",
  "Aucune candidature disponible.": "لا توجد طلبات متاحة.",
  "Aucun CV disponible pour cette candidature.": "لا توجد سيرة ذاتية لهذه الطلب.",
  "CV ouvert dans un nouvel onglet.": "تم فتح السيرة الذاتية في تبويب جديد.",
  "Aucun fichier de lettre de motivation disponible.": "لا يوجد ملف خطاب تحفيز متاح.",
  "Lettre de motivation ouverte dans un nouvel onglet.": "تم فتح خطاب التحفيز في تبويب جديد.",
  "Acces refuse": "تم رفض الوصول",
  "Votre compte entreprise n est pas encore lie a une fiche societe. L administrateur doit creer et affecter le compte.": "حساب الشركة غير مرتبط بملف شركة بعد. يجب على المسؤول إنشاء الربط وتعيينه.",
  "Chargement de l espace entreprise...": "جارٍ تحميل مساحة الشركة...",
  "Ouvrir l espace super admin": "فتح مساحة المشرف الأعلى",
  "Nombre total:": "الإجمالي:",
  "Societe inconnue": "شركة غير معروفة",
  "Offre inconnue": "عرض غير معروف",
  "Recue le": "تم الاستلام في",
  "fichier non nomme": "ملف بدون اسم",
  "Aucun texte de motivation.": "لا يوجد نص لخطاب التحفيز.",
  "Lettre de motivation (texte)": "خطاب التحفيز (نص)",
  "Fichier lettre:": "ملف الخطاب:",
  "Ouverture...": "جارٍ الفتح...",
  "Ouvrir CV": "فتح السيرة الذاتية",
  "CV indisponible": "السيرة الذاتية غير متاحة",
  "Ouvrir lettre motivation": "فتح خطاب التحفيز",
  "Fichier indisponible": "الملف غير متاح",
  "Chargement des candidatures...": "جارٍ تحميل الطلبات...",
  "Chargement de la liste...": "جارٍ تحميل القائمة...",
  "Offres total": "إجمالي العروض",
  "Offres publiees": "العروض المنشورة",
  "Candidatures en attente": "طلبات قيد الانتظار",
  "Chargement des donnees...": "جارٍ تحميل البيانات...",
  "Profil entreprise": "ملف الشركة",
  "Statut actuel:": "الحالة الحالية:",
  "Type:": "النوع:",
  Type: "النوع",
  SARL: "SARL",
  Startup: "شركة ناشئة",
  "slug-entreprise": "معرّف-الشركة",
  Secteur: "القطاع",
  Pays: "البلد",
  "Site web (https://...)": "الموقع الإلكتروني (https://...)",
  "Logo URL": "رابط الشعار",
  "Cover URL": "رابط الغلاف",
  Description: "الوصف",
  "Enregistrement...": "جارٍ الحفظ...",
  "Mettre a jour le profil": "تحديث الملف",
  "Pilotage de votre entreprise": "إدارة شركتك",
  "Modifier une offre": "تعديل عرض وظيفة",
  "Creer une offre": "إنشاء عرض وظيفة",
  "Annuler la modification": "إلغاء التعديل",
  "Sauvegarde...": "جارٍ الحفظ...",
  "Sauver statut": "حفظ الحالة",
  "Ouvrir la page publique": "فتح الصفحة العامة",
  "Aucune description fournie.": "لا يوجد وصف متاح.",
  "Creee le": "تم الإنشاء في",
  "Mise a jour le": "تم التحديث في",
  "Secteur:": "القطاع:",
  "Ville:": "المدينة:",
  "Pays:": "البلد:",
  "Featured:": "مميز:",
  Oui: "نعم",
  Non: "لا",
  "Super admin": "مشرف أعلى",
  "Open Live": "عرض مباشر",
  "Services professionnels": "الخدمات المهنية",
  "Decouvrez nos expertises et choisissez la formule qui correspond a votre besoin. Cette page centralise les informations essentielles et un formulaire rapide pour demander un accompagnement.": "اكتشف خبراتنا واختر الصيغة المناسبة لاحتياجك. هذه الصفحة تجمع المعلومات الأساسية مع نموذج سريع لطلب المرافقة.",
  "Nos prestations": "خدماتنا",
  "Strategie et conseil": "الاستراتيجية والاستشارة",
  "Transformation digitale": "التحول الرقمي",
  "Marketing et communication": "التسويق والتواصل",
  "Formation et accompagnement": "التكوين والمواكبة",
  "Diagnostic business, priorites claires et feuille de route realiste.": "تشخيص الأعمال مع أولويات واضحة وخارطة طريق واقعية.",
  "Optimisation de vos processus pour gagner en productivite et en qualite.": "تحسين العمليات لرفع الإنتاجية والجودة.",
  "Positionnement, visibilite et acquisition clients sur les canaux utiles.": "التموقع والظهور واكتساب العملاء عبر القنوات المناسبة.",
  "Montez en competence avec un cadre pratique adapte a votre equipe.": "طوّر الكفاءات بإطار عملي مناسب لفريقك.",
  "Audit complet de votre activite": "تدقيق كامل لنشاطك",
  "Plan d action concret sur 90 jours": "خطة عمل عملية لمدة 90 يوما",
  "Suivi de performance avec indicateurs": "متابعة الأداء بالمؤشرات",
  "Cartographie des processus internes": "رسم خريطة العمليات الداخلية",
  "Automatisation des taches repetitives": "أتمتة المهام المتكررة",
  "Mise en place de tableaux de pilotage": "إعداد لوحات قيادة ومتابعة",
  "Clarification de l offre et du message": "توضيح العرض والرسالة",
  "Campagnes digitales ciblees": "حملات رقمية مستهدفة",
  "Suivi des leads et taux de conversion": "متابعة العملاء المحتملين ونسبة التحويل",
  "Parcours de formation metier": "مسار تكويني مهني",
  "Coaching operationnel des equipes": "تأطير عملي للفرق",
  "Methode simple de progression continue": "منهج بسيط للتحسن المستمر",
  "Comment ca marche": "كيف نعمل",
  "Un process simple pour aller vite et obtenir une reponse claire.": "مسار بسيط للانطلاق بسرعة والحصول على رد واضح.",
  "01 Analyse du besoin": "01 تحليل الحاجة",
  "Nous comprenons votre contexte, vos objectifs et vos contraintes.": "نفهم سياقك وأهدافك وتحدياتك.",
  "02 Proposition detaillee": "02 عرض مفصل",
  "Vous recevez une proposition avec plan, delais et resultat attendu.": "تتلقى عرضا يتضمن الخطة والآجال والنتيجة المتوقعة.",
  "03 Lancement accompagne": "03 انطلاق بمواكبة",
  "Nous executons avec un suivi regulier jusqu aux livrables.": "ننفيذ مع متابعة منتظمة حتى التسليم.",
  "Demander plus d informations": "اطلب معلومات أكثر",
  "Choisissez le service qui vous interesse et envoyez votre demande en quelques secondes.": "اختر الخدمة التي تهمك وأرسل طلبك في ثوان.",
  "Choisir un service": "اختر خدمة",
  "Objectif principal (optionnel)": "الهدف الرئيسي (اختياري)",
  "Decrivez votre besoin, votre contexte et le resultat attendu": "صف حاجتك وسياقك والنتيجة المتوقعة",
  "Envoyer la demande de service": "إرسال طلب الخدمة",
  "Etudes de marche et analyse concurrentielle": "دراسات السوق والتحليل التنافسي",
  "Lecture claire du marche pour mieux positionner votre offre.": "قراءة واضحة للسوق لتحسين تموضع عرضك.",
  "Sondages terrain et entretiens clients": "استطلاعات ميدانية ومقابلات العملاء",
  "Analyse concurrence et signaux prix": "تحليل المنافسة وإشارات الأسعار",
  "Recommandations actionnables pour la croissance": "توصيات عملية للنمو",
  "Organisation d evenements professionnels": "تنظيم الفعاليات المهنية",
  "Conferences, forums et rencontres B2B pour accelerer vos opportunites.": "مؤتمرات ومنتديات ولقاءات B2B لتسريع فرصك.",
  "Planification logistique de A a Z": "تخطيط لوجستي من الألف إلى الياء",
  "Coordination des intervenants et partenaires": "تنسيق المتدخلين والشركاء",
  "Mesure d impact et rapport post-evenement": "قياس الأثر وتقرير ما بعد الحدث",
  "Questions frequentes": "الاسئلة الشائعة",
  "Quelle est la duree moyenne d un accompagnement ?": "ما هي المدة المتوسطة للمواكبة؟",
  "Selon votre besoin: de 1 semaine pour un audit rapide a 3 mois pour un programme complet.": "حسب حاجتك: من اسبوع واحد لتدقيق سريع الى 3 اشهر لبرنامج كامل.",
  "Proposez-vous un suivi apres la mission ?": "هل توفرون متابعة بعد انتهاء المهمة؟",
  "Oui, nous pouvons mettre en place un suivi mensuel avec indicateurs et ajustements.": "نعم، يمكننا اعداد متابعة شهرية مع مؤشرات وتعديلات.",
  "Comment est calcule le tarif ?": "كيف يتم احتساب التكلفة؟",
  "Le tarif depend du perimetre, du niveau d expertise mobilise et du delai demande.": "التكلفة تعتمد على نطاق العمل ومستوى الخبرة والمهلة المطلوبة.",
  "Verification anti-spam": "التحقق ضد الرسائل المزعجة",
  "Calculez:": "احسب:",
  "Votre reponse": "اجابتك",
  "Actualiser": "تحديث",
  "Verification anti-spam invalide. Merci de recalculer la somme.": "تحقق مكافحة السبام غير صحيح. يرجى اعادة حساب المجموع.",
  pending: "قيد الانتظار",
  shortlisted: "قائمة مختصرة",
  rejected: "مرفوض",
  hired: "تم التوظيف",
};

const DICTIONARIES: Record<Exclude<SiteLanguage, "fr">, LanguageDictionary> = {
  en: {
    ...EN_DICTIONARY,
    ...EN_EXTRA_DICTIONARY,
  },
  ar: {
    ...AR_DICTIONARY,
    ...AR_EXTRA_DICTIONARY,
  },
};

const DYNAMIC_RULES: Record<Exclude<SiteLanguage, "fr">, DynamicRule[]> = {
  en: [
    {
      pattern: /(\d+)\s+resultat\(s\)/gi,
      render: (count) => `${count} result(s)`,
    },
    {
      pattern: /(\d+)\s+offre\(s\)/gi,
      render: (count) => `${count} offer(s)`,
    },
    {
      pattern: /(\d+)\s+poste\(s\)/gi,
      render: (count) => `${count} position(s)`,
    },
    {
      pattern: /(\d+)\s+categorie\(s\)/gi,
      render: (count) => `${count} categor(y/ies)`,
    },
    {
      pattern: /(\d+)\s+reference\(s\)/gi,
      render: (count) => `${count} reference(s)`,
    },
    {
      pattern: /(\d+)\s+candidature\(s\)/gi,
      render: (count) => `${count} application(s)`,
    },
    {
      pattern: /(\d+)\s+services?/gi,
      render: (count) => `${count} service(s)`,
    },
    {
      pattern: /Reponse non JSON pour\s+(.+)$/gi,
      render: (path) => `Non-JSON response for ${path}`,
    },
  ],
  ar: [
    {
      pattern: /(\d+)\s+resultat\(s\)/gi,
      render: (count) => `${count} نتيجة`,
    },
    {
      pattern: /(\d+)\s+offre\(s\)/gi,
      render: (count) => `${count} عرض`,
    },
    {
      pattern: /(\d+)\s+poste\(s\)/gi,
      render: (count) => `${count} وظيفة`,
    },
    {
      pattern: /(\d+)\s+categorie\(s\)/gi,
      render: (count) => `${count} فئة`,
    },
    {
      pattern: /(\d+)\s+reference\(s\)/gi,
      render: (count) => `${count} مرجع`,
    },
    {
      pattern: /(\d+)\s+candidature\(s\)/gi,
      render: (count) => `${count} طلب`,
    },
    {
      pattern: /(\d+)\s+services?/gi,
      render: (count) => `${count} خدمة`,
    },
    {
      pattern: /Reponse non JSON pour\s+(.+)$/gi,
      render: (path) => `استجابة ليست JSON للمسار ${path}`,
    },
  ],
};

const TEXT_ORIGINALS = new WeakMap<Text, string>();
const ATTR_ORIGINALS = new WeakMap<Element, Map<string, string>>();
let originalDocumentTitle: string | null = null;

export function normalizeSiteLanguage(
  value: string | null | undefined
): SiteLanguage {
  if (value === "en" || value === "ar") {
    return value;
  }

  return "fr";
}

export function loadSiteLanguageFromStorage(): SiteLanguage {
  if (typeof window === "undefined") {
    return "fr";
  }

  try {
    return normalizeSiteLanguage(
      window.localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY)
    );
  } catch {
    return "fr";
  }
}

export function applyLanguageToDocument(language: SiteLanguage): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("lang", language);
  document.documentElement.setAttribute("data-language", language);
  document.documentElement.setAttribute("dir", language === "ar" ? "rtl" : "ltr");
}

export function setSiteLanguage(language: SiteLanguage): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures and still apply language for current session.
  }

  applyLanguageToDocument(language);
  window.dispatchEvent(
    new CustomEvent<{ language: SiteLanguage }>(SITE_LANGUAGE_EVENT, {
      detail: { language },
    })
  );
}

export function subscribeToSiteLanguage(
  listener: (language: SiteLanguage) => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ language?: SiteLanguage }>;
    listener(normalizeSiteLanguage(customEvent.detail?.language));
  };

  window.addEventListener(SITE_LANGUAGE_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(SITE_LANGUAGE_EVENT, handler as EventListener);
  };
}

function replaceExactAndPartial(
  input: string,
  dictionary: LanguageDictionary
): string {
  if (Object.hasOwn(dictionary, input)) {
    return dictionary[input];
  }

  const entries = Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length);
  let next = input;

  for (const [source, target] of entries) {
    if (!source || source.length < 4) {
      continue;
    }

    if (!next.includes(source)) {
      continue;
    }

    next = next.split(source).join(target);
  }

  return next;
}

function applyDynamicRules(
  input: string,
  rules: DynamicRule[]
): string {
  let next = input;

  for (const rule of rules) {
    next = next.replace(rule.pattern, (...args) => {
      const groups = args.slice(1, -2) as string[];
      return rule.render(...groups);
    });
  }

  return next;
}

function translateLiteral(
  value: string,
  language: SiteLanguage
): string {
  if (language === "fr") {
    return value;
  }

  const dictionary = DICTIONARIES[language];
  const dynamicRules = DYNAMIC_RULES[language];

  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) {
    return value;
  }

  const leading = match[1] ?? "";
  const core = match[2] ?? "";
  const trailing = match[3] ?? "";

  if (!core.trim()) {
    return value;
  }

  const exactOrPartial = replaceExactAndPartial(core, dictionary);
  const translatedCore = applyDynamicRules(exactOrPartial, dynamicRules);
  return `${leading}${translatedCore}${trailing}`;
}

function shouldSkipElement(element: Element | null): boolean {
  let current: Element | null = element;

  while (current) {
    if (current.hasAttribute("data-i18n-skip")) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function walkAndTranslateTextNodes(root: ParentNode, language: SiteLanguage): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let current = walker.nextNode();
  while (current) {
    const textNode = current as Text;

    if (!shouldSkipElement(textNode.parentElement)) {
      if (!TEXT_ORIGINALS.has(textNode)) {
        TEXT_ORIGINALS.set(textNode, textNode.data);
      }

      const original = TEXT_ORIGINALS.get(textNode) ?? textNode.data;
      const next = language === "fr" ? original : translateLiteral(original, language);

      if (next !== textNode.data) {
        textNode.data = next;
      }
    }

    current = walker.nextNode();
  }
}

function translateAttributes(root: ParentNode, language: SiteLanguage): void {
  const elements = root.querySelectorAll("*");

  for (const element of elements) {
    if (shouldSkipElement(element)) {
      continue;
    }

    let storedAttrs = ATTR_ORIGINALS.get(element);
    if (!storedAttrs) {
      storedAttrs = new Map<string, string>();
      ATTR_ORIGINALS.set(element, storedAttrs);
    }

    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
      const currentValue = element.getAttribute(attribute);
      if (!currentValue) {
        continue;
      }

      if (!storedAttrs.has(attribute)) {
        storedAttrs.set(attribute, currentValue);
      }

      const original = storedAttrs.get(attribute) ?? currentValue;
      const next = language === "fr" ? original : translateLiteral(original, language);

      if (next !== currentValue) {
        element.setAttribute(attribute, next);
      }
    }

    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase();
      const hasTranslatableValue = type === "button" || type === "submit" || type === "reset";

      if (!hasTranslatableValue || !element.value) {
        continue;
      }

      if (!storedAttrs.has("__input_value")) {
        storedAttrs.set("__input_value", element.value);
      }

      const originalValue = storedAttrs.get("__input_value") ?? element.value;
      const nextValue = language === "fr" ? originalValue : translateLiteral(originalValue, language);

      if (nextValue !== element.value) {
        element.value = nextValue;
      }
    }
  }
}

function translateDocumentTitle(language: SiteLanguage): void {
  if (typeof document === "undefined") {
    return;
  }

  if (originalDocumentTitle === null) {
    originalDocumentTitle = document.title;
  }

  const sourceTitle = originalDocumentTitle || document.title;
  document.title = language === "fr" ? sourceTitle : translateLiteral(sourceTitle, language);
}

export function translateDocumentContent(language: SiteLanguage): void {
  if (typeof document === "undefined") {
    return;
  }

  translateDocumentTitle(language);
  walkAndTranslateTextNodes(document.body, language);
  translateAttributes(document.body, language);
}
