# Scan code et ameliorations possibles

Date du scan: 2026-05-07  
Projet: `carte-visitee`

## Guides Next.js consultes

Conformement a `AGENTS.md`, les guides locaux Next.js 16 ont ete lus avant de documenter le projet:

- `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md`

Points retenus pour ce projet: App Router dans `app/`, routes API via `route.ts`, variables non publiques uniquement cote serveur, validation des entrees dans les mutations, et approche proche d'une Data Access Layer dans `lib/server`.

## Resume executif

Le projet est une application Next.js 16 orientee annuaire d'entreprises, offres d'emploi, candidatures, contact et demandes de creation de site. La base technique est saine: TypeScript strict, helpers API centralises, validations metier, tests d'integration, schema Supabase avec RLS et buckets Storage.

Les principales ameliorations possibles concernent la maintenabilite frontend, la securite operationnelle en production et la consolidation de l'acces donnees.

## Cartographie du code

| Zone | Role |
| --- | --- |
| `app/layout.tsx` | Layout racine, metadata, polices, initialisation theme/langue |
| `app/page.tsx` | Landing publique avec recherche, categories, entreprises et offres |
| `app/entreprises/[slug]/page.tsx` | Fiche entreprise publique |
| `app/categories/[slug]/page.tsx` | Page categorie publique |
| `app/contact/page.tsx` | Contact et candidature depuis une offre |
| `app/create-site/page.tsx` | Demande de creation de site |
| `app/espace-entreprise/*` | Interface entreprise: profil, jobs, candidatures |
| `app/espace-admin/*` | Interface admin: entreprises, candidatures, messages |
| `app/test/*` | Ecrans de test manuel API |
| `app/ui/*` | Session auth, banniere, theme, langue |
| `lib/server/*` | Reponses API, auth, Supabase REST/Storage, validation, rate limit, emails |
| `supabase/schema.sql` | Tables, enums, indexes, triggers, RLS, policies Storage |
| `tests/integration/*` | Couverture integration des routes API |

## Endpoints API

### Public

| Endpoint | Methodes | Role |
| --- | --- | --- |
| `/api/health` | GET | Verifie config Supabase et acces minimal |
| `/api/categories` | GET | Liste categories actives |
| `/api/companies` | GET | Liste entreprises actives avec filtres |
| `/api/companies/[slug]` | GET | Detail entreprise active avec jobs, services, news, categories |
| `/api/jobs` | GET | Liste offres publiees |
| `/api/jobs/[id]` | GET | Detail offre publiee |
| `/api/search` | GET | Recherche transverse entreprises, offres, services |
| `/api/applications` | POST | Candidature publique avec upload CV |
| `/api/applications/[id]/receipt` | GET | Recu de candidature par UUID |
| `/api/contact` | POST | Message contact avec rate limit |
| `/api/site-requests` | POST | Demande de site avec rate limit |

### Entreprise

| Endpoint | Methodes | Role |
| --- | --- | --- |
| `/api/company/profile` | GET, POST, PATCH | Lire, creer ou modifier le profil entreprise lie |
| `/api/company/jobs` | GET, POST | Lister et creer les offres de l'entreprise |
| `/api/company/jobs/[id]` | PATCH, DELETE | Modifier ou supprimer une offre possedee |
| `/api/company/applications` | GET | Lister les candidatures de l'entreprise |
| `/api/company/applications/[id]/status` | PATCH | Changer le statut d'une candidature possedee |
| `/api/company/applications/[id]/cv` | GET | Generer une URL signee de CV |
| `/api/company/applications/[id]/motivation-letter` | GET | Generer une URL signee de lettre de motivation |

### Super admin

| Endpoint | Methodes | Role |
| --- | --- | --- |
| `/api/admin/companies` | GET, POST | Lister et creer des entreprises |
| `/api/admin/companies/[id]` | PATCH, DELETE | Modifier ou supprimer une entreprise |
| `/api/admin/applications` | GET | Lister toutes les candidatures |
| `/api/admin/applications/[id]/cv` | GET | Generer une URL signee de CV |
| `/api/admin/applications/[id]/motivation-letter` | GET | Generer une URL signee de lettre de motivation |
| `/api/admin/contact-messages` | GET | Lister les messages contact |
| `/api/admin/site-requests` | GET | Lister les demandes de creation de site |

## Flux principaux

### Recherche et consultation publique

1. La landing charge `/api/companies`, `/api/jobs` et `/api/categories`.
2. Les filtres et mots cles appellent `/api/search`.
3. Les fiches detail utilisent `/api/companies/[slug]`.
4. Les offres redirigent vers `/contact?job=<id>` pour candidature.

### Candidature

1. Le candidat envoie un formulaire multipart vers `/api/applications`.
2. Le backend valide l'UUID de l'offre, les champs candidat, la taille et le MIME du CV.
3. Le CV est uploade dans `candidate-cv` sous `company/<companyId>/applications/<applicationId>/...`.
4. Une ligne `applications` est creee.
5. Des emails sont envoyes au candidat et a l'entreprise si la config email est disponible.

### Espace entreprise

1. Le client stocke une session Supabase cote navigateur.
2. Les appels API envoient `Authorization: Bearer <accessToken>`.
3. `requireEntrepriseActor` verifie le token puis le role `entreprise`.
4. Les endpoints comparent toujours `company_id` avec `actor.companyId` avant mutation ou telechargement.

### Super admin

1. Les endpoints admin utilisent `requireSuperAdminActor`.
2. Les actions admin peuvent lire/modifier les entreprises, candidatures, messages et demandes.
3. Les telechargements de fichiers passent par URLs signees temporaires.

## Variables d'environnement

Variables principales:

| Variable | Usage |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | URL publique locale/prod |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase exposee au client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle anon Supabase exposee au client |
| `SUPABASE_SERVICE_ROLE_KEY` | Cle serveur pour Route Handlers et scripts |
| `SUPABASE_STORAGE_CV_BUCKET` | Bucket prive des CV |
| `SUPABASE_STORAGE_COMPANY_MEDIA_BUCKET` | Bucket media entreprise |
| `SMTP_*` | Envoi email via SMTP |
| `RESEND_*` | Envoi email via Resend si SMTP absent |
| `ADMIN_NOTIFICATION_EMAIL` | Destinataire notifications admin |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | Reglages rate limit public |
| `CV_MAX_SIZE_MB`, `CV_ALLOWED_MIME_TYPES` | Contraintes upload CV |
| `CV_DOWNLOAD_URL_EXP_SECONDS` | Duree des URLs signees CV/lettres |

## Qualite et tests

Points positifs constates:

- TypeScript strict active.
- Reponses API homogenes via `apiSuccess`, `apiError`, `handleApiError`.
- Validation JSON centralisee via `parseJsonRequestBody`.
- Validations metier pour jobs et statuts de candidature.
- Tests integration couvrant lecture publique, ecritures entreprise, admin, contact, site requests, CV et recherche.
- Schema SQL idempotent avec triggers `updated_at`, indexes et RLS.

Commandes recommandees avant livraison:

```bash
npm run lint
npm run test:integration
npm run build
```

## Risques et dette technique

| Priorite | Sujet | Impact | Recommandation |
| --- | --- | --- | --- |
| Haute | Session Supabase en `localStorage` | Exposition accrue en cas de XSS | Migrer vers cookies HttpOnly ou flow auth serveur si possible |
| Haute | Rate limit en memoire | Inefficace en multi-instance/serverless | Utiliser Redis, Upstash, Supabase ou un service partage |
| Haute | `/api/applications/[id]/receipt` public par UUID | Toute personne avec l'UUID lit nom/email/status | Ajouter un token de recu non devinable, expiration, ou verification email |
| Haute | Backend avec service-role | RLS contournee par design | Garder les guards applicatifs obligatoires et ajouter tests de non-regression authz |
| Moyenne | Gros composants client | Maintenance difficile, bundle plus lourd | Extraire composants et hooks, convertir les lectures initiales en Server Components quand utile |
| Moyenne | Duplication auth Supabase client | Risque d'ecarts entre login, signup, banner, session | Centraliser tout le client auth dans `app/ui/auth-session.ts` ou un module dedie |
| Moyenne | Emails best-effort silencieux | Erreurs invisibles pour l'operationnel | Ajouter dashboard/logging email_events et alertes sur echecs |
| Moyenne | Construction URL Supabase REST a la main | Risque d'encodage ou filtre fragile | Introduire helpers de query PostgREST plus types |
| Basse | Pages `/test` accessibles | Surface inutile en production | Masquer en prod ou proteger par variable/env admin |
| Basse | README et docs historiques mixtes FR/EN | Onboarding moins fluide | Standardiser une langue et un style documentaire |

## Ameliorations proposees

### Court terme

1. Proteger ou desactiver les pages `/test` en production.
2. Ajouter tests integration pour `/api/admin/applications/[id]/motivation-letter` et `/api/company/applications/[id]/motivation-letter`.
3. Ajouter une verification specifique du endpoint public `/api/applications/[id]/receipt`.
4. Documenter les roles attendus dans Supabase: `visitor`, `entreprise`, `super_admin`.
5. Ajouter une section "Deploy" avec checklist Vercel/Supabase.

### Moyen terme

1. Refactorer `app/page.tsx`, `app/espace-admin/page.tsx` et `app/espace-entreprise/page.tsx` en composants plus petits.
2. Extraire les types API partages dans `lib/shared` pour eviter duplication frontend/backend.
3. Remplacer le stockage token navigateur par une strategie auth plus resistante.
4. Mettre le rate limit dans un stockage partage.
5. Creer un module DAL explicite par domaine (`companies`, `jobs`, `applications`) au-dessus de Supabase REST.

### Long terme

1. Ajouter monitoring applicatif: erreurs API, latence Supabase, taux d'echec emails, uploads Storage.
2. Ajouter audit trail admin pour changements sensibles.
3. Ajouter pagination detaillee sur news/services si le volume augmente.
4. Ajouter tests E2E navigateur sur les flux candidat, entreprise et admin.
5. Ajouter CI avec lint, tests, build et verification env non-secrete.

## Checklist de maintenance

- Avant changement API: mettre a jour la table endpoints de ce document.
- Avant changement auth: ajouter un test 401, 403 et succes.
- Avant changement upload: tester MIME, taille, bucket, URL signee et expiration.
- Avant release: lancer lint, integration tests et build.
- Avant production: verifier que `.env.local` n'est pas commite et que les secrets sont dans l'environnement cible.
