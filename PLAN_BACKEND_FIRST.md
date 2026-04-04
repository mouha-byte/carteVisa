# Plan Backend Execution (Backend First)

## Vision
Construire un backend fiable avant la vraie interface utilisateur, avec une UI de test minimale pour valider tous les flux.

Definition de succes:
- Les routes critiques fonctionnent de bout en bout (API, DB, storage, emails).
- Les permissions sont correctes selon les roles.
- Les tests automatises couvrent les flux principaux.
- Le front final ne commence qu'apres validation backend.

## Etat actuel
### Deja fait
- Schema SQL initial cree et execute via supabase/schema.sql
- Buckets storage en place: candidate-cv et company-media
- Verification des integrations disponible via scripts/verify-env.ps1
- Seed idempotent disponible via scripts/seed-db.ps1
- Donnees de base seedees (users, companies, jobs, categories, services, news, applications, messages)
- Sprint 1 endpoints lecture implementes (health, categories, companies, jobs)
- Tests d'integration Sprint 1 en place et valides (vitest)
- Sprint 2 endpoints write initiaux implementes pour espace entreprise (profil + jobs)
- Tests d'integration Sprint 2 initiaux en place et valides (auth/permissions/create/update/delete)
- Sprint 2 endpoints candidatures entreprise implementes (listing + update status)
- Tests d'integration Sprint 2 etendus et valides (16 tests)
- Sprint 3 endpoints candidature publique implementes (multipart + receipt)
- Validation upload CV activee (MIME/taille) + stockage bucket candidate-cv
- Sprint 4 emails transactionnels implementes sur flux candidature (candidat + entreprise)
- Log email_events avec cycle queued/sent/failed + resilience en cas d'erreur Resend
- Sprint 5 endpoints formulaires externes implementes (contact + site-requests + listes admin)
- Notifications admin implementees pour contact et demande site web
- Protection anti abus basique activee (rate limit) sur endpoints publics de formulaires
- Sprint 6 stabilisation backend engagee (gardes auth centralises + parsing JSON uniforme)
- Mapping des erreurs upstream stabilise via helper central de reponse API
- Relecture permissions/RLS documentee endpoint par endpoint (docs/backend-permissions-rls-matrix.md)
- Tests d'integration backend etendus et valides (32 tests)
- Smoke test manuel E2E execute en local avec environnement reel (17/17 checks passes)
- Validation des permissions par role confirmee avec comptes seedes (entreprise vs super_admin)
- Verification DB TCP Supabase resolue via endpoint pooler configure dans SUPABASE_DB_URL
- Endpoints admin entreprises implementes (listing + update + suppression + creation)
- Telechargement CV securise implemente pour entreprise et super_admin (URL signee)
- Filtre categorie ajoute sur l'endpoint public des offres (/api/jobs)

### A verifier
- Aucun blocage infra ouvert sur l'environnement local

## Stack
- Next.js App Router (API routes)
- Supabase Postgres + Auth + Storage
- Resend pour emails transactionnels

## Architecture backend cible
### Dossiers
- app/api/* pour routes HTTP
- lib/supabase/* pour clients Supabase (anon et service)
- lib/validation/* pour schemas de validation
- lib/http/* pour reponses standard et gestion erreurs
- lib/services/* pour logique metier

### Contrat de reponse API
Reponse succes:
{
  "success": true,
  "data": {},
  "meta": {}
}

Reponse erreur:
{
  "success": false,
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human readable message"
  }
}

## Priorites produit (ordre strict)
1. Auth et roles
2. Entreprises CRUD
3. Offres emplois CRUD
4. Candidatures + upload CV
5. Notifications email
6. Contact + demandes creation site
7. Recherche et filtres

## Plan backend par sprint

### Sprint 1 - API publique lecture
Objectif: exposer les donnees publiques necessaires a la landing.

Endpoints:
- GET /api/health
- GET /api/categories
- GET /api/companies
- GET /api/companies/[slug]
- GET /api/jobs
- GET /api/jobs/[id]

Definition of done:
- Pagination basique
- Filtres: q, city, category, sort
- Reponses standardisees
- Tests integration routes lecture

### Sprint 2 - Espace entreprise (write)
Objectif: donner a une entreprise la gestion de son contenu.

Endpoints:
- POST /api/company/profile
- PATCH /api/company/profile
- POST /api/company/jobs
- GET /api/company/jobs
- PATCH /api/company/jobs/[id]
- DELETE /api/company/jobs/[id]
- GET /api/company/applications
- PATCH /api/company/applications/[id]/status

Definition of done:
- Permissions role entreprise appliquees
- Validation payload stricte
- Test permissions entreprise vs autres comptes

### Sprint 3 - Flux candidature
Objectif: rendre candidature complete et testable.

Endpoints:
- POST /api/applications (multipart)
- GET /api/applications/[id]/receipt

Regles:
- Upload uniquement PDF/DOC/DOCX
- Taille max selon CV_MAX_SIZE_MB
- Ecriture storage bucket candidate-cv

Definition of done:
- Candidature creee en DB
- Fichier stocke correctement
- Retour de confirmation exploitable pour UI

### Sprint 4 - Emails transactionnels
Objectif: brancher Resend sur les evenements critiques.

Evenements:
- Confirmation candidat apres candidature
- Notification entreprise nouvelle candidature
- Notification admin nouveau message contact
- Notification admin nouvelle demande site web

Definition of done:
- Envoi email effectif
- Log dans table email_events
- Gestion erreur resend sans casser la transaction principale

### Sprint 5 - Contact et demande creation site
Objectif: finaliser les formulaires externes.

Endpoints:
- POST /api/contact
- POST /api/site-requests
- GET /api/admin/contact-messages
- GET /api/admin/site-requests

Definition of done:
- Ecriture DB correcte
- Notification admin envoyee
- Protections anti abus basiques (rate limit)

### Sprint 6 - Stabilisation et prepa front final
Objectif: verrouiller la qualite backend avant UI finale.

Taches:
- Logs erreurs homogenes
- Mapping codes erreurs stable
- Relecture RLS et permissions endpoint par endpoint
- Nettoyage du code service

Definition of done:
- Checklist securite validee
- Smoke test E2E passe
- Backend declare pret pour front final

## Checklist backend globale

### Auth et roles
- [x] Login entreprise
- [x] Login super admin
- [x] Protection endpoints prives
- [x] Verification permissions par role

### Entreprises et offres
- [x] CRUD entreprise
- [x] Activation/desactivation entreprise (admin)
- [x] CRUD offre emploi
- [x] Liste offres par entreprise

### Candidatures
- [x] Soumission candidature
- [x] Upload CV PDF/Word
- [x] Changement statut candidature
- [x] Telechargement CV entreprise/admin

### Emails et formulaires
- [x] Confirmation candidat
- [x] Notification entreprise candidature
- [x] Notification admin contact
- [x] Notification admin demande site

### Recherche
- [x] Recherche mot cle
- [x] Filtre categorie
- [x] Filtre ville

## Tests a mettre en place
### Unit tests
- Validation input
- Regles statut candidature
- Fonctions autorisation role

### Integration tests
- Routes API avec DB test
- Storage upload CV
- Mock Resend pour emails

### Smoke tests manuels
1. Publier une offre
2. Postuler avec CV
3. Changer statut candidature
4. Verifier emails
5. Envoyer contact
6. Envoyer demande creation site

## Ce qu'on ne fait pas maintenant
- UI finale de landing
- Dashboard analytics avance
- Systeme pub avance multi-campagnes

## Prochaine action immediate
1. Rejouer un smoke test E2E complet apres les derniers endpoints admin/CV/recherche
2. Basculer sur l'implementation du front final (consommation des APIs backend)
3. Mettre en place la UI dashboard admin/entreprise sur les routes finalisees
