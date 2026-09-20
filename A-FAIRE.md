# À faire plus tard

Choses identifiées mais volontairement pas construites maintenant — pas oubliées, juste pas urgentes. Cocher `[x]` quand fait, ou supprimer la ligne.

## Techniques

- [ ] **Stripe / SEPA pour les commissions.** Le règlement (pro → SansAgents, SansAgents → client) reste manuel par virement. À automatiser quand le volume rendra la vérification manuelle trop lente — pas avant.
- [ ] **Pré-rendu (SSR) des pages annonce/pro pour le SEO.** Le sitemap dynamique (ajouté le 8/09/2026) couvre la découverte des pages par Google ; le rendu 100% côté client reste un frein potentiel pour l'indexation elle-même. À revisiter une fois qu'il y a du vrai trafic organique à protéger.
- [ ] **Fichier CSS partagé (`sa-styles.css`).** Chaque page réécrit ses propres classes de boutons/cartes au lieu de partager un fichier commun — cause historique de plusieurs bugs visuels cette session (bordures fragmentées, survol qui ne matchait pas). Toutes les valeurs sont désormais unifiées (voir la charte graphique), mais toujours dupliquées fichier par fichier.
- [ ] **Moteur de blog / contenu éditorial.** Pour le SEO longue traîne (face à PAP notamment). C'est un chantier de rédaction de contenu, pas juste de code — à cadrer séparément si voulu.

## Organisationnel

- [ ] **Faire évoluer l'admin au-delà d'une seule personne.** Modération des réclamations/mises en avant/signalements entièrement manuelle sur une seule page. Pas un problème tant que le volume reste faible — à revisiter si ça devient un goulot d'étranglement.
- [ ] **Suite en cas de non-paiement après suspension automatique.** Le système envoie relances + suspend automatiquement à J+22, mais ne va pas plus loin. Si un professionnel suspendu ne réagit toujours pas : mise en demeure formelle par courrier recommandé (l'email automatique ne vaut que comme relance informelle) puis, en dernier recours, injonction de payer auprès du tribunal de commerce. Décision humaine à chaque fois, pas automatisée.

## Visibilité (voir le Guide de visibilité)

- [ ] **Search Console : demander l'indexation** de /annonces, /guide-vendeur, /professionnels, /estimer-son-bien (quota ~10/jour).
- [ ] **Search Console : revérifier dans ~2 semaines** (Indexation > Pages) — les 14 pages « Découvertes, actuellement non indexées » devraient diminuer.
- [ ] **Démarcher 10-15 professionnels locaux** pour lancer l'annuaire (il est inutile vide).
- [ ] **Page LinkedIn entreprise** — reportée (compte personnel compliqué pour l'instant).
- [ ] **Trustpilot / avis** — reporté tant qu'il n'y a aucune transaction à évaluer.
- [ ] **Publicité Google Ads, presse startup, backlinks** — phases 2 et 3 du guide, quand le reste est en place.

## Fait (pour référence)

- [x] Sitemap dynamique (annonces + pros, régénéré chaque jour) — 08/09/2026
- [x] Relances + suspension automatique des pros qui ne paient pas leur commission (avec copie de chaque email envoyée au fondateur) — 08/09/2026
- [x] Charte graphique / design system — 08/09/2026
- [x] Unification des 3 incohérences de couleurs/tailles relevées dans la charte — 08/09/2026
- [x] Correctif critique de sécurité (auto-attribution du rôle admin, contournement de suspension) — 14/09/2026
- [x] Sitemap nettoyé (pages noindex retirées), description ajoutée sur cgu.html — 14/09/2026
- [x] Search Console : propriété vérifiée, sitemap accepté (statut Succès), accueil indexé — 20/09/2026
- Écarté : Profil d'établissement Google (site 100 % en ligne, sans adresse ni zone de service : non éligible)
