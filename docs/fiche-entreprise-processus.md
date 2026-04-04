# Processus Fiche Entreprise

Ce fichier documente le parcours utilisateur quand on clique sur une entreprise depuis la landing, ainsi que les sections a afficher dans la fiche.

## Objectif

Donner une fiche entreprise complete, claire et orientee conversion (consultation + candidature + contact).

## Parcours utilisateur

1. Depuis la landing, l utilisateur clique sur une entreprise.
2. Le systeme ouvre la page dynamique `/entreprises/[slug]`.
3. La page charge les donnees via l API `GET /api/companies/[slug]`.
4. Les sections suivantes sont affichees dans cet ordre.

## Sections obligatoires de la fiche

1. En-tete entreprise
- Logo
- Nom
- Secteur d activite
- Image principale (cover)

2. Informations generales
- Description complete de l entreprise
- Adresse
- Telephone
- E-mail
- Site web

3. Postes ouverts
- Liste des offres actives
- Bouton `Postuler` pour chaque poste
- Redirection vers contact/candidature avec identifiant du poste

4. Localisation
- Carte Google Maps embarquee
- Basee sur adresse/ville/pays

5. Galerie photos
- Cover + medias entreprise
- Images d actualites si disponibles

6. Produits / Services
- Liste ou catalogue des services
- Bouton dedie `Demander ce service`

7. Actualites entreprise
- Flux des dernieres annonces
- Nouveautes, produits, evenements

## Exigences UX/UI

- Rendu professionnel sombre coherent avec la landing.
- Photo entreprise dominante sur les cartes et en haut de fiche.
- Boutons CTA visibles (`Postuler`, `Voir fiche`, `Demander ce service`).
- Responsive mobile/desktop.

## Donnees techniques

- Source principale: `GET /api/companies/[slug]`
- Champs clefs:
  - `logo_url`, `cover_url`
  - `description`, `address`, `phone`, `email`, `website_url`
  - `jobs[]`, `services[]`, `news[]`, `categories[]`

## Evolution recommandee

- Ajouter pagination de news si volume important.
- Ajouter filtres postes (ville, contrat, remote).
- Ajouter suivi analytics: clic fiche, clic postuler, clic service.
