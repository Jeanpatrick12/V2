/* ════════════════════════════════════════════════════════════════
   SansAgents — module partagé v2 (Supabase)
   Remplace le localStorage par une vraie base de données.
   Toutes les pages doivent charger dans cet ordre :
     1. @supabase/supabase-js (CDN)
     2. sa-config.js          (vos clés Supabase)
     3. ce fichier            (sa-shared.js)
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const TYPE_LABELS = { maison: "Maison", appartement: "Appartement", studio: "Studio", loft: "Loft / Atelier" };
  const TYPE_ICONS  = { maison: "ti-home", appartement: "ti-building", studio: "ti-door", loft: "ti-tools" };

  /* ── Données de démonstration (restent côté client, non modifiables) ── */
  const DEMO_LISTINGS = [
    { id:"d1",  type:"appartement", transaction:"vente",    title:"Appartement 3 pièces — Lyon 7e",        ville:"Lyon",       postal:"69007", price:245000, charges:0,   surface:68,  pieces:3, chambres:2, dpe:"C", meuble:null,    img:"lyon",     desc:"Bel appartement traversant, cuisine équipée, proche transports et commerces.", createdAt:1700000001, contactPrenom:"Élodie", contactNom:"Marchand", equipements:["Ascenseur","Cave","Digicode"] },
    { id:"d2",  type:"maison",      transaction:"vente",    title:"Maison avec jardin — Bordeaux",          ville:"Bordeaux",   postal:"33000", price:385000, charges:0,   surface:120, pieces:5, chambres:4, dpe:"D", meuble:null,    img:"bordeaux", desc:"Maison familiale avec jardin clos, garage et belle exposition sud.", createdAt:1700000002, contactPrenom:"Nicolas", contactNom:"Berthier", equipements:["Jardin privatif","Garage individuel","Terrasse"] },
    { id:"d3",  type:"studio",      transaction:"location", title:"Studio meublé — Paris 11e",              ville:"Paris",      postal:"75011", price:850,    charges:60,  surface:24,  pieces:1, chambres:0, dpe:"E", meuble:"meuble",img:"paris",    desc:"Studio meublé, lumineux, à deux pas du métro, idéal jeune actif.", createdAt:1700000003, contactPrenom:"Camille", contactNom:"Roy", equipements:["Ascenseur","Interphone"] },
    { id:"d4",  type:"loft",        transaction:"vente",    title:"Loft atelier d'artiste — Lille",         ville:"Lille",      postal:"59000", price:310000, charges:0,   surface:95,  pieces:4, chambres:2, dpe:"D", meuble:null,    img:"lille",    desc:"Ancien atelier industriel reconverti, volumes exceptionnels, cachet préservé.", createdAt:1700000004, contactPrenom:"Hugo", contactNom:"Lambert", equipements:["Parking privé","Cave"] },
    { id:"d5",  type:"appartement", transaction:"location", title:"Appartement 2 pièces — Marseille 6e",    ville:"Marseille",  postal:"13006", price:720,    charges:60,  surface:50,  pieces:2, chambres:1, dpe:"D", meuble:"vide",  img:"p4",       desc:"Appartement calme et lumineux, proche commerces et écoles.", createdAt:1700000005, contactPrenom:"Sarah", contactNom:"Benamar", equipements:["Balcon","Cave"] },
    { id:"d6",  type:"maison",      transaction:"vente",    title:"Maison contemporaine — Nantes",          ville:"Nantes",     postal:"44000", price:295000, charges:0,   surface:110, pieces:4, chambres:3, dpe:"B", meuble:null,    img:"p5",       desc:"Maison récente basse consommation, belle terrasse, quartier recherché.", createdAt:1700000006, contactPrenom:"Julien", contactNom:"Faure", equipements:["Terrasse","Garage individuel","Point de recharge VE"] },
    { id:"d7",  type:"studio",      transaction:"vente",    title:"Studio rénové — Toulouse centre",        ville:"Toulouse",   postal:"31000", price:98000,  charges:0,   surface:22,  pieces:1, chambres:0, dpe:"D", meuble:null,    img:"p6",       desc:"Studio entièrement rénové en plein centre-ville, idéal investissement.", createdAt:1700000007, contactPrenom:"Laura", contactNom:"Petit", equipements:["Digicode"] },
    { id:"d8",  type:"appartement", transaction:"vente",    title:"Appartement avec balcon — Strasbourg",   ville:"Strasbourg", postal:"67000", price:215000, charges:0,   surface:75,  pieces:3, chambres:2, dpe:"C", meuble:null,    img:"p7",       desc:"Appartement avec balcon filant, double exposition, cave et parking.", createdAt:1700000008, contactPrenom:"Thomas", contactNom:"Weber", equipements:["Balcon","Cave","Parking extérieur"] },
    { id:"d9",  type:"maison",      transaction:"location", title:"Villa avec vue mer — Nice",              ville:"Nice",       postal:"06000", price:1450,   charges:90,  surface:95,  pieces:4, chambres:3, dpe:"C", meuble:"meuble",img:"p1",       desc:"Villa meublée avec vue mer dégagée, terrasse et piscine partagée.", createdAt:1700000009, contactPrenom:"Anaïs", contactNom:"Giordano", equipements:["Terrasse","Piscine","Vue mer / lac / montagne"] },
    { id:"d10", type:"loft",        transaction:"location", title:"Loft industriel — Paris 19e",            ville:"Paris",      postal:"75019", price:1600,   charges:0,   surface:80,  pieces:2, chambres:1, dpe:"E", meuble:"vide",  img:"p2",       desc:"Loft open space avec verrière, idéal télétravail, quartier en plein essor.", createdAt:1700000010, contactPrenom:"Maxime", contactNom:"Girard", equipements:["Cave"] },
    { id:"d11", type:"appartement", transaction:"vente",    title:"Appartement lumineux — Rennes",          ville:"Rennes",     postal:"35000", price:178000, charges:0,   surface:58,  pieces:3, chambres:2, dpe:"B", meuble:null,    img:"p3",       desc:"Appartement refait à neuf, proche métro, faibles charges de copropriété.", createdAt:1700000011, contactPrenom:"Pauline", contactNom:"Morel", equipements:["Ascenseur","Local à vélos sécurisé"] },
    { id:"d12", type:"maison",      transaction:"vente",    title:"Maison de ville — Lille",                ville:"Lille",      postal:"59000", price:340000, charges:0,   surface:130, pieces:5, chambres:4, dpe:"E", meuble:null,    img:"p0",       desc:"Maison de ville avec cour, proche centre, à rafraîchir partiellement.", createdAt:1700000012, contactPrenom:"Olivier", contactNom:"Renard", equipements:["Cave","Grenier / Combles aménageables"] },
    { id:"d13", type:"studio",      transaction:"location", title:"Studio étudiant — Lyon 3e",              ville:"Lyon",       postal:"69003", price:580,    charges:40,  surface:20,  pieces:1, chambres:0, dpe:"D", meuble:"meuble",img:"p4",       desc:"Studio meublé idéal étudiant, proche universités et tramway.", createdAt:1700000013, contactPrenom:"Inès", contactNom:"Dubois", equipements:["Ascenseur","Digicode"] },
    { id:"d14", type:"appartement", transaction:"location", title:"Appartement familial — Bordeaux",        ville:"Bordeaux",   postal:"33000", price:980,    charges:70,  surface:65,  pieces:3, chambres:2, dpe:"C", meuble:"vide",  img:"p5",       desc:"Appartement familial avec balcon, proche écoles et tramway.", createdAt:1700000014, contactPrenom:"Marie", contactNom:"Lefort", equipements:["Balcon","Parking en sous-sol"] }
  ];

  const DEMO_PROS = [
    { id:"pr1",  name:"Maître Sophie Lefebvre",     job:"Notaire",            cat:"immobilier", city:"Lyon",      rating:4.9, reviews:127, color:"#2563eb", icon:"ti-stamp",        desc:"Spécialiste des actes de vente entre particuliers, accompagnement complet jusqu'à la signature.", verified:true,  longDesc:"Notaire installée à Lyon depuis plus de 15 ans, Maître Lefebvre accompagne chaque année plusieurs centaines de transactions entre particuliers.", services:["Rédaction et relecture de compromis de vente","Signature d'acte authentique","Vérification des diagnostics obligatoires","Séquestre et sécurisation des fonds","Conseil en succession et donation"], zone:"Lyon et métropole", siret:"", phone:"04 78 00 00 00", email:"contact@lefebvre-notaire.fr" },
    { id:"pr2",  name:"Cabinet Roussel & Associés", job:"Notaire",            cat:"immobilier", city:"Paris",     rating:4.7, reviews:203, color:"#2563eb", icon:"ti-stamp",        desc:"Étude notariale familiale, plus de 20 ans d'expérience en transactions immobilières.", verified:true,  longDesc:"Étude familiale fondée il y a plus de 20 ans, le Cabinet Roussel & Associés intervient sur l'ensemble de la région parisienne.", services:["Compromis et actes de vente","Successions et donations","Conseil patrimonial","Vérification d'urbanisme"], zone:"Paris et Île-de-France", siret:"", phone:"01 42 00 00 00", email:"contact@roussel-notaires.fr" },
    { id:"pr3",  name:"Julie Marchand",             job:"Diagnostiqueur DPE", cat:"immobilier", city:"Paris",     rating:5.0, reviews:52,  color:"#1a8c4e", icon:"ti-ruler-2",      desc:"Diagnostics DPE, amiante, plomb et électricité réalisés en 48h, rapport détaillé fourni.", verified:true,  longDesc:"Diagnostiqueuse certifiée, Julie réalise l'ensemble des diagnostics obligatoires en moins de 48h.", services:["Diagnostic de performance énergétique (DPE)","Diagnostic amiante","Diagnostic plomb (CREP)","Diagnostic électricité et gaz","Mesurage loi Carrez / Boutin"], zone:"Paris et petite couronne", siret:"", phone:"06 00 00 00 01", email:"julie.marchand@diag-paris.fr" },
    { id:"pr4",  name:"Marc Dubreuil",              job:"Diagnostiqueur DPE", cat:"immobilier", city:"Nantes",    rating:4.6, reviews:38,  color:"#1a8c4e", icon:"ti-ruler-2",      desc:"Diagnostics immobiliers complets, certifié, intervention rapide sur Nantes et alentours.", verified:false, longDesc:"Diagnostiqueur certifié intervenant sur Nantes et sa périphérie.", services:["DPE","Diagnostic amiante et plomb","Diagnostic termites","Mesurage loi Carrez"], zone:"Nantes, Saint-Herblain, Rezé", siret:"", phone:"06 00 00 00 02", email:"marc.dubreuil@diagnostics44.fr" },
    { id:"pr5",  name:"Camille Faure",              job:"Géomètre",           cat:"immobilier", city:"Toulouse",  rating:4.8, reviews:45,  color:"#7c3aed", icon:"ti-map-2",        desc:"Bornage, division de terrain et levés topographiques pour particuliers et notaires.", verified:true,  longDesc:"Géomètre-expert basée à Toulouse, Camille intervient pour les particuliers comme pour les notaires.", services:["Bornage contradictoire","Division de terrain","Levé topographique","Implantation de construction"], zone:"Toulouse et Haute-Garonne", siret:"", phone:"06 00 00 00 03", email:"camille.faure@geometre31.fr" },
    { id:"pr6",  name:"Karim Benali",               job:"Électricien",        cat:"travaux",    city:"Bordeaux",  rating:4.8, reviews:84,  color:"#E84533", icon:"ti-bulb",         desc:"Mise aux normes, rénovation électrique complète, devis gratuit sous 24h.", verified:true,  longDesc:"Électricien indépendant depuis 12 ans, Karim réalise la mise aux normes et la rénovation électrique complète.", services:["Mise aux normes NF C 15-100","Rénovation électrique complète","Tableau électrique","Recherche de panne","Installation de bornes de recharge VE"], zone:"Bordeaux et métropole", siret:"", phone:"06 00 00 00 04", email:"karim.benali@elec-bordeaux.fr" },
    { id:"pr7",  name:"Thomas Petit",               job:"Carreleur",          cat:"travaux",    city:"Lille",     rating:4.7, reviews:63,  color:"#9333ea", icon:"ti-brick",        desc:"Pose de carrelage et faïence, salles de bain et cuisines, finitions soignées.", verified:false, longDesc:"Carreleur de métier, Thomas réalise la pose de carrelage et de faïence.", services:["Pose de carrelage sol et mur","Pose de faïence","Rénovation de salle de bain","Chape et ragréage"], zone:"Lille et métropole", siret:"", phone:"06 00 00 00 05", email:"thomas.petit@carrelage-lille.fr" },
    { id:"pr8",  name:"Nadia Cherif",               job:"Plaquiste",          cat:"travaux",    city:"Marseille", rating:4.5, reviews:41,  color:"#0891b2", icon:"ti-layout-board", desc:"Cloisons, faux plafonds et isolation, intervention rapide sur tout le département.", verified:true,  longDesc:"Plaquiste expérimentée, Nadia intervient sur tout le département.", services:["Cloisons placo","Faux plafonds","Isolation thermique et phonique","Doublage de mur"], zone:"Marseille et Bouches-du-Rhône", siret:"", phone:"06 00 00 00 06", email:"nadia.cherif@plaquiste13.fr" },
    { id:"pr9",  name:"Vincent Roy",                job:"Peintre",            cat:"travaux",    city:"Lyon",      rating:4.6, reviews:57,  color:"#d97706", icon:"ti-paint",        desc:"Peinture intérieure et extérieure, ravalement de façade, devis personnalisé.", verified:false, longDesc:"Peintre en bâtiment, Vincent réalise les travaux de peinture intérieure et extérieure.", services:["Peinture intérieure","Peinture extérieure","Ravalement de façade","Pose de revêtements muraux"], zone:"Lyon et région", siret:"", phone:"06 00 00 00 07", email:"vincent.roy@peinture-lyon.fr" },
    { id:"pr10", name:"Antoine Garcia",             job:"Plombier",           cat:"travaux",    city:"Toulouse",  rating:4.9, reviews:96,  color:"#0d9488", icon:"ti-droplet",      desc:"Dépannage, installation sanitaire et chauffage, disponible 7j/7 pour les urgences.", verified:true,  longDesc:"Plombier-chauffagiste disponible 7j/7 pour les urgences.", services:["Dépannage plomberie urgent","Installation sanitaire complète","Installation et entretien chaudière","Détection de fuite"], zone:"Toulouse et Haute-Garonne", siret:"", phone:"06 00 00 00 08", email:"antoine.garcia@plomberie31.fr" },
    { id:"pr11", name:"Bâti Rénov Atlantique",      job:"Entreprise tous corps d'état", cat:"travaux", city:"Nantes", rating:4.7, reviews:71, color:"#444", icon:"ti-tools", desc:"Rénovation complète clé en main : un seul interlocuteur pour tous les corps de métier.", verified:true, longDesc:"Entreprise tous corps d'état, Bâti Rénov Atlantique coordonne l'ensemble des artisans.", services:["Rénovation complète clé en main","Coordination de chantier","Gros œuvre et second œuvre","Devis global unique"], zone:"Nantes et Loire-Atlantique", siret:"", phone:"06 00 00 00 09", email:"contact@batirenov-atlantique.fr" }
  ];

  /* ── Cache mémoire (données chargées au démarrage) ─────────────── */
  const _cache = {
    user:          null,
    dbListings:    [],
    dbPros:        [],
    favorites:     [],
    favoritesData: [],
    conversations: [],
    searches:      _readLocalJSON("sa_searches_v1", []),
    initialized:   false
  };

  let _sb = null;
  let _initPromise = null;

  /* ── Utilitaires locaux ─────────────────────────────────────────── */
  function _readLocalJSON(key, fallback) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
  }
  function _writeLocalJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return h;
  }
  function uid() { return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ── Normalisation des données venant de la DB ──────────────────── */
  function _normListing(row) {
    return {
      id:                row.id,
      owner_id:          row.owner_id,
      type:              row.type,
      transaction:       row.transaction,
      title:             row.title || "",
      ville:             row.ville || "",
      postal:            row.postal || "",
      adresse:           row.adresse || "",
      price:             parseFloat(row.price),
      charges:           parseFloat(row.charges || 0),
      surface:           parseFloat(row.surface),
      pieces:            row.pieces,
      chambres:          row.chambres,
      sdb:               row.sdb,
      dpe:               row.dpe,
      ges:               row.ges,
      factureEnergie:    row.facture_energie != null ? parseFloat(row.facture_energie) : null,
      meuble:            row.meuble,
      etage:             row.etage,
      anneeConstruction: row.annee_construction,
      etatGeneral:       row.etat_general,
      terrain:           row.terrain != null ? parseFloat(row.terrain) : null,
      niveauxMaison:     row.niveaux_maison,
      hauteurPlafond:    row.hauteur_plafond != null ? parseFloat(row.hauteur_plafond) : null,
      origineBatiment:   row.origine_batiment,
      chauffageMode:     row.chauffage_mode,
      sourceEnergie:     row.source_energie,
      chauffage:         row.chauffage,
      eauChaude:         row.eau_chaude,
      configMaison:      row.config_maison,
      img:               row.img || "p0",
      photos:            Array.isArray(row.photos) ? row.photos : [],
      plans:             Array.isArray(row.plans) ? row.plans : [],
      equipements:       Array.isArray(row.equipements) ? row.equipements : [],
      desc:              row.description || "",
      contactPrenom:     row.contact_prenom || "",
      contactNom:        row.contact_nom || "",
      contactEmail:      row.contact_email || "",
      contactTel:        row.contact_tel || "",
      status:            row.status || "active",
      createdAt:         row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      isUserListing:     true
    };
  }
  function _normPro(row) {
    return {
      id:        row.id,
      owner_id:  row.owner_id,
      name:      row.name,
      job:       row.job,
      cat:       row.cat,
      city:      row.city,
      zone:      row.zone,
      siret:     row.siret,
      phone:     row.phone,
      email:     row.email,
      desc:      row.description || "",
      longDesc:  row.long_desc || "",
      services:  Array.isArray(row.services) ? row.services : [],
      rating:    parseFloat(row.rating || 0),
      reviews:   parseInt(row.reviews || 0, 10),
      color:     row.color || "#E84533",
      icon:      row.icon || "ti-briefcase",
      logo:      row.logo,
      verified:  !!row.verified,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      isUserPro: true
    };
  }
  function _normConvo(row) {
    return {
      id:                 row.id,
      listingId:          row.listing_id,
      listingTitle:       row.listing_title || "Annonce",
      contactName:        row.contact_name || "L'annonceur",
      contactShared:      !!row.contact_shared,
      buyerConfirmedSale: !!row.buyer_confirmed_sale,
      buyerConfirmedAt:   row.buyer_confirmed_at,
      buyer_id:           row.buyer_id,
      seller_id:          row.seller_id,
      lastMessageAt:      row.last_message_at ? new Date(row.last_message_at).getTime() : null,
      lastReadAt:         row.last_read_at,
      createdAt:          row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      messages:           Array.isArray(row.messages) ? row.messages.map(_normMsg).sort((a,b) => a.createdAt - b.createdAt) : []
    };
  }
  function _normMsg(row) {
    return {
      id:        row.id,
      from:      row.from_role,
      senderId:  row.sender_id || null,
      text:      row.text,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
  }

  /* ── Upload photo vers Supabase Storage ────────────────────────── */
  async function _uploadPhoto(dataUrl) {
    if (!_sb || !_cache.user) return null;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const ext  = blob.type === "image/png" ? "png" : "jpg";
      const path = _cache.user.id + "/" + Date.now() + "." + ext;
      const { error } = await _sb.storage.from("listings-photos").upload(path, blob, { contentType: blob.type });
      if (error) { console.error("Upload photo:", error); return null; }
      return _sb.storage.from("listings-photos").getPublicUrl(path).data.publicUrl;
    } catch (e) { console.error("Upload photo:", e); return null; }
  }

  /* ── Documents locaux ──────────────────────────────────────────── */
  // Purge unique : les documents mélangés entre comptes (ancien bug) sont
  // supprimés du stockage local une fois pour toutes chez chaque visiteur.
  try {
    if (!localStorage.getItem("sa_docs_purge_v1")) {
      Object.keys(localStorage).forEach(function(k) {
        if (k.indexOf("sa_user_docs") === 0) localStorage.removeItem(k);
      });
      localStorage.setItem("sa_docs_purge_v1", "1");
    }
  } catch(e) {}

  function _docsKey(uid) { return uid ? "sa_user_docs_" + uid : "sa_user_docs_guest"; }
  function _getLocalDocs(uid) {
    try { return JSON.parse(localStorage.getItem(_docsKey(uid)) || "[]"); } catch(e) { return []; }
  }
  function _setLocalDocs(docs, uid) {
    localStorage.setItem(_docsKey(uid), JSON.stringify(docs));
  }

  async function saveDoc(doc) {
    if (!doc || !doc.type) return;
    var user = getUser();
    var uid = user && user.id;
    var docs = _getLocalDocs(uid);
    docs = docs.filter(function(d) { return d.type !== doc.type; });
    docs.unshift(doc);
    if (docs.length > 20) docs = docs.slice(0, 20);
    _setLocalDocs(docs, uid);
    if (user && _sb) {
      try {
        await _sb.from("user_documents").upsert(
          { user_id: user.id, doc_type: doc.type, doc_data: doc, updated_at: new Date().toISOString() },
          { onConflict: "user_id,doc_type" }
        );
      } catch(e) {}
    }
  }

  async function deleteDoc(docType) {
    var user = getUser();
    var uid = user && user.id;
    var docs = _getLocalDocs(uid);
    docs = docs.filter(function(d) { return d.type !== docType; });
    _setLocalDocs(docs, uid);
    if (user && _sb) {
      try {
        await _sb.from("user_documents").delete().eq("user_id", user.id).eq("doc_type", docType);
      } catch(e) {}
    }
  }

  function getDocs() {
    var uid = _cache.user && _cache.user.id;
    if (!uid) return [];
    return _getLocalDocs(uid);
  }

  /* ── Chargement des données utilisateur (après login) ──────────── */
  async function _loadUserData(userId) {
    const [favRes, convoRes, soldRes, docsRes] = await Promise.all([
      _sb.from("favorites").select("item_id,item_type").eq("user_id", userId),
      _sb.from("conversations")
        .select("id,listing_id,listing_title,contact_name,contact_shared,buyer_confirmed_sale,buyer_confirmed_at,buyer_id,seller_id,last_message_at,last_read_at,created_at,messages(id,from_role,sender_id,text,created_at)")
        .or("buyer_id.eq." + userId + ",seller_id.eq." + userId)
        .order("created_at", { ascending: false }),
      _sb.from("listings")
        .select("id,owner_id,type,transaction,title,ville,postal,adresse,price,charges,surface,pieces,chambres,sdb,dpe,ges,facture_energie,meuble,etage,annee_construction,etat_general,terrain,niveaux_maison,hauteur_plafond,origine_batiment,chauffage_mode,source_energie,chauffage,eau_chaude,config_maison,img,photos,plans,equipements,description,contact_prenom,contact_nom,contact_email,contact_tel,status,created_at")
        .eq("owner_id", userId),
      _sb.from("user_documents").select("doc_type,doc_data,updated_at").eq("user_id", userId).order("updated_at", { ascending: false })
    ]);
    _cache.favorites     = (favRes.data || []).map(f => f.item_id);
    _cache.favoritesData = (favRes.data || []);
    _cache.conversations = (convoRes.data || []).map(_normConvo);
    _cache.searches      = _readLocalJSON("sa_searches_v1_" + userId, []);
    // Pour les conversations où je suis vendeur, récupérer le prénom/nom de l'acheteur
    const sellerConvos = _cache.conversations.filter(c => c.seller_id === userId && c.buyer_id);
    if (sellerConvos.length > 0) {
      const buyerIds = [...new Set(sellerConvos.map(c => c.buyer_id))];
      const { data: buyerProfiles } = await _sb.from("profiles").select("id,prenom,nom").in("id", buyerIds);
      if (buyerProfiles) {
        const pm = {};
        buyerProfiles.forEach(p => { pm[p.id] = p; });
        _cache.conversations.forEach(c => {
          if (c.seller_id === userId && c.buyer_id && pm[c.buyer_id]) {
            const p = pm[c.buyer_id];
            c.contactName = ((p.prenom || '') + ' ' + (p.nom || '')).trim() || "L'acheteur";
          }
        });
      }
    }
    const ownerListings  = (soldRes.data || []).map(_normListing);
    const existingIds = new Set(_cache.dbListings.map(l => l.id));
    ownerListings.forEach(l => { if (!existingIds.has(l.id)) _cache.dbListings.push(l); });
    // Sync documents: Supabase is authoritative. Merge only THIS user's unsynced local cache.
    const sbDocs = (docsRes.data || []).map(function(r) { return r.doc_data; }).filter(Boolean);
    const localDocs = _getLocalDocs(userId);
    const sbTypes = new Set(sbDocs.map(function(d) { return d.type; }));
    localDocs.forEach(function(d) {
      if (!sbTypes.has(d.type)) {
        sbDocs.push(d);
        _sb.from("user_documents").upsert(
          { user_id: userId, doc_type: d.type, doc_data: d, updated_at: new Date().toISOString() },
          { onConflict: "user_id,doc_type" }
        ).then(function() {});
      }
    });
    if (sbDocs.length || localDocs.length) {
      _setLocalDocs(sbDocs, userId);
      if (typeof window.loadDocs === "function") window.loadDocs();
    }
  }

  /* ── INIT — point d'entrée principal de chaque page ─────────────
     Appeler SA.init() (ou await SA.init()) en haut de chaque page.
     La fonction est idempotente : plusieurs appels ne rechargent pas. */
  async function _doInit() {
    if (!window.SA_CONFIG || !window.SA_CONFIG.url || window.SA_CONFIG.url.startsWith("COLLER")) {
      console.error("SansAgents : remplissez sa-config.js avec vos clés Supabase.");
      _cache.initialized = true;
      mountNavAuth();
      return;
    }

    _sb = window.supabase.createClient(SA_CONFIG.url, SA_CONFIG.anonKey);

    const [sessionRes, listingsRes, prosRes] = await Promise.all([
      _sb.auth.getSession(),
      _sb.from("listings")
        .select("id,owner_id,type,transaction,title,ville,postal,adresse,price,charges,surface,pieces,chambres,sdb,dpe,ges,facture_energie,meuble,etage,annee_construction,etat_general,terrain,niveaux_maison,hauteur_plafond,origine_batiment,chauffage_mode,source_energie,chauffage,eau_chaude,config_maison,img,photos,plans,equipements,description,contact_prenom,contact_nom,status,created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      _sb.from("pros")
        .select("id,owner_id,name,job,cat,city,zone,siret,phone,email,description,long_desc,services,rating,reviews,color,icon,logo,verified,created_at")
        .order("created_at", { ascending: false })
    ]);

    _cache.dbListings = (listingsRes.data || []).map(_normListing);
    _cache.dbPros     = (prosRes.data || []).map(_normPro);

    const session = sessionRes.data && sessionRes.data.session;
    if (session) {
      let { data: profile } = await _sb.from("profiles").select("*").eq("id", session.user.id).single();
      // Profil manquant (trigger raté à l'inscription) → on le crée maintenant
      if (!profile) {
        const meta = session.user.user_metadata || {};
        const fallbackPrenom = meta.prenom || session.user.email.split("@")[0];
        await _sb.from("profiles").upsert({
          id:     session.user.id,
          email:  session.user.email,
          prenom: fallbackPrenom,
          nom:    meta.nom || ""
        });
        const { data: created } = await _sb.from("profiles").select("*").eq("id", session.user.id).single();
        profile = created;
      }
      _cache.user = profile || null;
      if (_cache.user) await _loadUserData(_cache.user.id);
    }

    _cache.initialized = true;
    mountNavAuth();
  }

  function init() {
    if (!_initPromise) _initPromise = _doInit();
    return _initPromise;
  }

  /* ── Utilitaires publics (synchrones, inchangés) ────────────────── */
  function fmtPrice(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Math.round(n).toLocaleString("fr-FR") + " €";
  }
  function fmtPriceTransaction(listing) {
    return listing.transaction === "vente" ? fmtPrice(listing.price) : fmtPrice(listing.price) + "/mois";
  }
  function parseAddress(address) {
    if (!address) return { ville: "—", postal: "" };
    const m = String(address).match(/(\d{5})\s*,?\s*([^,]+)$/);
    if (m) return { postal: m[1], ville: m[2].trim() };
    const parts = String(address).split(",");
    return { postal: "", ville: parts[parts.length - 1].trim() || address.trim() };
  }
  function piecesFromSelect(val) {
    if (!val) return null;
    const m = String(val).match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  function dpeLetterFrom(val) {
    if (!val) return null;
    return String(val).trim().charAt(0).toUpperCase();
  }
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function titleFor(type, pieces, ville, meuble) {
    let base = TYPE_LABELS[type] || "Bien";
    if ((type === "appartement" || type === "maison") && pieces) base += " " + pieces + " pièces";
    let suffix = meuble === "meuble" ? " meublé" : "";
    return base + suffix + " — " + ville;
  }
  function containsContactInfo(text) {
    const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    const phoneRe = /(?:\+33|0033|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/;
    const digitsOnly = text.replace(/[^\d]/g, "");
    const longDigitRun = /(\d[\s.\-]?){9,}/.test(text) && digitsOnly.length >= 9;
    return emailRe.test(text) || phoneRe.test(text) || longDigitRun;
  }
  function hasEquip(listing, keywords) {
    const list = (listing.equipements || []).map((e) => String(e).toLowerCase());
    if (!list.length) return false;
    return keywords.some((k) => list.some((e) => e.indexOf(String(k).toLowerCase()) !== -1));
  }
  function compressImageFile(file, maxDim, quality) {
    maxDim = maxDim || 1280; quality = quality || 0.72;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read-failed"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("decode-failed"));
        img.onload = () => {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxDim || h > maxDim) {
            if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
            else { w = Math.round(w * (maxDim / h)); h = maxDim; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          try { resolve(canvas.toDataURL("image/jpeg", quality)); } catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── Annonces ──────────────────────────────────────────────────── */
  function getAllListings() { return DEMO_LISTINGS.concat(_cache.dbListings); }
  function getListingById(id) { return getAllListings().find((l) => l.id === id) || null; }
  function getUserListings() { return _cache.dbListings.filter(l => _cache.user && l.owner_id === _cache.user.id); }

  async function addListing(data) {
    if (!_cache.user) throw new Error("auth-required");
    // Traitement des photos : convertir base64 → URLs Supabase Storage
    const uploadedPhotos = [];
    for (const photo of (Array.isArray(data.photos) ? data.photos : [])) {
      const raw = photo && (photo.url || photo);
      if (raw && typeof raw === "string" && raw.startsWith("data:")) {
        const url = await _uploadPhoto(raw);
        if (url) uploadedPhotos.push({ url });
      } else if (raw) {
        uploadedPhotos.push(photo);
      }
    }
    const addr = parseAddress(data.adresse);
    const row = {
      owner_id:          _cache.user.id,
      type:              data.type,
      transaction:       data.transaction,
      title:             titleFor(data.type, data.pieces, addr.ville, data.meuble),
      ville:             addr.ville,
      postal:            addr.postal,
      adresse:           data.adresse || "",
      price:             data.price,
      charges:           data.charges || 0,
      surface:           data.surface,
      pieces:            data.pieces,
      chambres:          data.chambres != null ? data.chambres : null,
      sdb:               data.sdb != null ? data.sdb : null,
      dpe:               data.dpe || null,
      ges:               data.ges || null,
      facture_energie:   data.factureEnergie != null ? data.factureEnergie : null,
      meuble:            data.meuble || null,
      etage:             data.etage != null ? data.etage : null,
      annee_construction:data.anneeConstruction || null,
      etat_general:      data.etatGeneral || null,
      terrain:           data.terrain != null ? data.terrain : null,
      niveaux_maison:    data.niveauxMaison || null,
      hauteur_plafond:   data.hauteurPlafond != null ? data.hauteurPlafond : null,
      origine_batiment:  data.origineBatiment || null,
      chauffage_mode:    data.chauffageMode || null,
      source_energie:    data.sourceEnergie || null,
      chauffage:         data.chauffage || null,
      eau_chaude:        data.eauChaude || null,
      config_maison:     data.configMaison || null,
      img:               "p" + (Math.abs(hashStr(_cache.user.id)) % 8),
      photos:            uploadedPhotos,
      plans:             Array.isArray(data.plans) ? data.plans : [],
      equipements:       Array.isArray(data.equipements) ? data.equipements : [],
      description:       data.desc || "",
      contact_prenom:    data.contactPrenom || "",
      contact_nom:       data.contactNom || "",
      contact_email:     data.contactEmail || "",
      contact_tel:       data.contactTel || "",
      status:            "active"
    };
    const { data: inserted, error } = await _sb.from("listings").insert(row).select().single();
    if (error) throw error;
    const normalized = _normListing(inserted);
    normalized.contactEmail = inserted.contact_email || "";
    normalized.contactTel   = inserted.contact_tel || "";
    _cache.dbListings.unshift(normalized);
    return normalized;
  }

  async function updateListing(id, patch) {
    const dbPatch = {};
    if (patch.status !== undefined)             dbPatch.status = patch.status;
    if (patch.price !== undefined)              dbPatch.price = patch.price;
    if (patch.desc !== undefined)               dbPatch.description = patch.desc;
    if (patch.contactTel !== undefined)         dbPatch.contact_tel = patch.contactTel;
    if (patch.contactEmail !== undefined)       dbPatch.contact_email = patch.contactEmail;
    if (patch.surface !== undefined)            dbPatch.surface = patch.surface;
    if (patch.pieces !== undefined)             dbPatch.pieces = patch.pieces;
    if (patch.chambres !== undefined)           dbPatch.chambres = patch.chambres;
    if (patch.sdb !== undefined)                dbPatch.sdb = patch.sdb;
    if (patch.sallesEau !== undefined)          dbPatch.salles_eau = patch.sallesEau;
    if (patch.anneeConstruction !== undefined)  dbPatch.annee_construction = patch.anneeConstruction;
    if (patch.etatGeneral !== undefined)        dbPatch.etat_general = patch.etatGeneral;
    if (patch.factureEnergie !== undefined)     dbPatch.facture_energie = patch.factureEnergie;
    if (patch.dpe !== undefined)                dbPatch.dpe = patch.dpe;
    if (patch.ges !== undefined)                dbPatch.ges = patch.ges;
    if (patch.equipements !== undefined)        dbPatch.equipements = patch.equipements;
    // Photos : upload les nouvelles (base64) et conserver les URLs existantes
    if (patch.photos !== undefined) {
      const uploadedPhotos = [];
      for (const photo of patch.photos) {
        const raw = photo && (photo.url || photo);
        if (raw && typeof raw === "string" && raw.startsWith("data:")) {
          const url = await _uploadPhoto(raw);
          if (url) uploadedPhotos.push({ url });
        } else if (raw) {
          uploadedPhotos.push(photo);
        }
      }
      dbPatch.photos = uploadedPhotos;
      patch = Object.assign({}, patch, { photos: uploadedPhotos });
    }
    if (Object.keys(dbPatch).length) {
      const { error } = await _sb.from("listings").update(dbPatch).eq("id", id);
      if (error) throw error;
    }
    const idx = _cache.dbListings.findIndex(l => l.id === id);
    if (idx !== -1) Object.assign(_cache.dbListings[idx], patch);
    return true;
  }

  /* ── Favoris ────────────────────────────────────────────────────── */
  function getFavorites() { return _cache.favorites.slice(); }
  function getFavoritesData() { return _cache.favoritesData.slice(); }
  function isFavorite(id) { return _cache.favorites.indexOf(id) !== -1; }

  async function toggleFavorite(id) {
    const idx = _cache.favorites.indexOf(id);
    const nowFav = idx === -1;
    if (nowFav) {
      _cache.favorites.push(id);
      if (_sb && _cache.user) {
        await _sb.from("favorites").insert({ user_id: _cache.user.id, item_id: id });
      }
    } else {
      _cache.favorites.splice(idx, 1);
      if (_sb && _cache.user) {
        await _sb.from("favorites").delete().eq("user_id", _cache.user.id).eq("item_id", id);
      }
    }
    mountFavBadge();
    return nowFav;
  }

  async function toggleFavoriteUI(btn, id) {
    const nowFav = await toggleFavorite(id);
    btn.classList.toggle("active", nowFav);
    const i = btn.querySelector("i");
    i.className = "ti " + (nowFav ? "ti-heart-filled" : "ti-heart");
    if (typeof window.refreshGrid === "function") window.refreshGrid();
    toast(nowFav ? "Ajouté à vos favoris" : "Retiré de vos favoris", nowFav ? "ti-heart-filled" : "ti-heart");
  }

  /* ── Recherches enregistrées (par utilisateur) ───────────────────── */
  function _searchesKey() { return _cache.user ? "sa_searches_v1_" + _cache.user.id : "sa_searches_v1_guest"; }
  function getSavedSearches() { return _cache.searches.slice(); }
  function addSavedSearch(criteria) {
    const search = { id: uid(), label: _labelForSearch(criteria), criteria: criteria, createdAt: Date.now() };
    _cache.searches.unshift(search);
    _writeLocalJSON(_searchesKey(), _cache.searches);
    return search;
  }
  function removeSavedSearch(id) {
    _cache.searches = _cache.searches.filter(s => s.id !== id);
    _writeLocalJSON(_searchesKey(), _cache.searches);
  }
  function _labelForSearch(c) {
    const bits = [];
    bits.push(c.transaction === "location" ? "Location" : c.transaction === "vente" ? "Vente" : "Tous biens");
    if (c.types && c.types.length) bits.push(c.types.map(t => TYPE_LABELS[t]).join(", "));
    if (c.ville) bits.push(c.ville);
    if (c.prixMin || c.prixMax) {
      const fmtN = n => Number(n).toLocaleString("fr-FR");
      bits.push(fmtN(c.prixMin || 0) + "–" + (c.prixMax ? fmtN(c.prixMax) : "∞") + " €");
    }
    if (c.equip && c.equip.length) bits.push(c.equip.length + " équipement(s)");
    return bits.join(" · ");
  }

  /* ── Messagerie ─────────────────────────────────────────────────── */
  function getConversations() { return _cache.conversations.slice(); }
  function getConversation(id) { return _cache.conversations.find(c => c.id === id) || null; }
  function getConversationByListing(listingId) { return _cache.conversations.find(c => c.listingId === listingId) || null; }
  function hasConversation(listingId) { return !!getConversationByListing(listingId); }
  function getUnreadMessageCount() {
    return _cache.conversations.reduce((n, c) => {
      const unread = (c.messages || []).some(m => m.from === "other" && m.createdAt > (new Date(c.lastReadAt || 0).getTime()));
      return n + (unread ? 1 : 0);
    }, 0);
  }

  async function sendMessage(listingId, text) {
    text = String(text || "").trim();
    if (!text) return null;
    if (containsContactInfo(text)) {
      return { blocked: true, reason: "Pour la sécurité de tous, les numéros de téléphone et e-mails ne peuvent pas être envoyés directement dans un message. Utilisez le bouton « Partager mes coordonnées » si vous souhaitez les transmettre." };
    }
    if (!_cache.user) return { blocked: true, reason: "Vous devez être connecté pour envoyer un message." };

    const listing = getListingById(listingId);
    let convo = getConversationByListing(listingId);
    const contactName = listing ? ((listing.contactPrenom || "") + " " + (listing.contactNom || "")).trim() || "L'annonceur" : "L'annonceur";

    if (!convo) {
      // Trouver le seller_id (owner du listing en DB, null pour les démos)
      const sellerId = listing && listing.owner_id ? listing.owner_id : null;
      const { data: newConvo, error: ce } = await _sb.from("conversations").insert({
        listing_id:    listingId,
        listing_title: listing ? listing.title : "Annonce",
        contact_name:  contactName,
        buyer_id:      _cache.user.id,
        seller_id:     sellerId,
        last_read_at:  new Date().toISOString()
      }).select("id,listing_id,listing_title,contact_name,contact_shared,buyer_confirmed_sale,buyer_confirmed_at,buyer_id,seller_id,last_message_at,last_read_at,created_at").single();
      if (ce) throw ce;
      convo = _normConvo(newConvo);
      convo.messages = [];
      _cache.conversations.unshift(convo);
    }

    const { data: msg, error: me } = await _sb.from("messages").insert({
      conversation_id: convo.id,
      from_role:       "me",
      sender_id:       _cache.user.id,
      text:            text
    }).select("id,from_role,sender_id,text,created_at").single();
    if (me) {
      if (me.message && me.message.includes("CONTACT_INFO_BLOCKED")) {
        return { blocked: true, reason: "Pour la sécurité de tous, les coordonnées de contact ne peuvent pas être partagées directement dans un message." };
      }
      throw me;
    }

    convo.messages.push(_normMsg(msg));

    // Mise à jour last_message_at
    await _sb.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convo.id);
    convo.lastMessageAt = Date.now();

    mountMsgBadge();
    return convo;
  }

  async function setContactShared(convoId, shared) {
    const convo = _cache.conversations.find(c => c.id === convoId);
    if (!convo) return null;
    const { error } = await _sb.from("conversations").update({ contact_shared: !!shared }).eq("id", convoId);
    if (error) throw error;
    convo.contactShared = !!shared;
    const myName = _cache.user ? ((_cache.user.prenom || '') + ' ' + (_cache.user.nom || '')).trim() || "L'annonceur" : "L'annonceur";
    const systemText = shared
      ? myName + " a choisi de partager ses coordonnées avec vous."
      : myName + " a retiré le partage de ses coordonnées.";
    await _sb.from("messages").insert({ conversation_id: convoId, from_role: "system", text: systemText });
    convo.messages.push({ from: "system", text: systemText, createdAt: Date.now() });
    return convo;
  }

  async function setBuyerConfirmedSale(convoId, confirmed) {
    const convo = _cache.conversations.find(c => c.id === convoId);
    if (!convo) return null;
    const now = new Date().toISOString();
    const { error } = await _sb.from("conversations").update({ buyer_confirmed_sale: !!confirmed, buyer_confirmed_at: now }).eq("id", convoId);
    if (error) throw error;
    convo.buyerConfirmedSale = !!confirmed;
    convo.buyerConfirmedAt   = now;
    return convo;
  }

  async function markConversationRead(id) {
    const convo = _cache.conversations.find(c => c.id === id);
    if (!convo) return;
    const now = new Date().toISOString();
    await _sb.from("conversations").update({ last_read_at: now }).eq("id", id);
    convo.lastReadAt = now;
    mountMsgBadge();
  }

  async function deleteConversation(id) {
    await _sb.from("conversations").delete().eq("id", id);
    _cache.conversations = _cache.conversations.filter(c => c.id !== id);
    mountMsgBadge();
  }

  /* ── Annuaire professionnels ─────────────────────────────────────── */
  function getAllPros() { return DEMO_PROS.concat(_cache.dbPros); }
  function getProById(id) { return getAllPros().find(p => p.id === id) || null; }
  function getUserPros() { return _cache.dbPros.filter(p => _cache.user && p.owner_id === _cache.user.id); }

  async function addPro(data) {
    if (!_cache.user) throw new Error("auth-required");
    const siret = String(data.siret || "").replace(/\s/g, "");
    if (!/^\d{14}$/.test(siret)) throw new Error("siret-invalid");
    const row = {
      owner_id:    _cache.user.id,
      name:        data.name || "",
      job:         data.job || "",
      cat:         data.cat || "immobilier",
      city:        data.city || "",
      zone:        data.zone || "",
      siret:       siret,
      phone:       data.phone || "",
      email:       data.email || "",
      description: data.desc || "",
      long_desc:   data.longDesc || data.desc || "",
      services:    Array.isArray(data.services) ? data.services : [],
      color:       "#E84533",
      icon:        data.icon || "ti-briefcase",
      logo:        data.logo || null,
      verified:    false
    };
    const { data: inserted, error } = await _sb.from("pros").insert(row).select().single();
    if (error) throw error;
    const normalized = _normPro(inserted);
    _cache.dbPros.unshift(normalized);
    return normalized;
  }

  async function setProVerified(id, verified) {
    const { error } = await _sb.from("pros").update({ verified: !!verified }).eq("id", id);
    if (error) throw error;
    const pro = _cache.dbPros.find(p => p.id === id);
    if (pro) pro.verified = !!verified;
  }

  /* ── Authentification ───────────────────────────────────────────── */
  function getUser() { return _cache.user; }

  async function login(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: profile } = await _sb.from("profiles").select("*").eq("id", data.user.id).single();
    _cache.user = profile;
    if (profile) await _loadUserData(profile.id);
    mountNavAuth();
    return _cache.user;
  }

  async function signup(data) {
    // Appel REST direct (pas de client Supabase → jamais de blocage)
    const res = await fetch(SA_CONFIG.url + "/auth/v1/signup", {
      method: "POST",
      headers: { "apikey": SA_CONFIG.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        data: { prenom: data.prenom || "", nom: data.nom || "" }
      })
    });
    const j = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      let msg = j.msg || j.error_description || j.message || "Erreur lors de la création du compte.";
      if (/already/i.test(msg)) msg = "Un compte existe déjà avec cet email.";
      else if (/rate limit|too many/i.test(msg)) msg = "Trop de demandes — patientez quelques minutes puis réessayez.";
      else if (/invalid.*email|email.*invalid/i.test(msg)) msg = "Adresse email invalide.";
      else if (/password/i.test(msg)) msg = "Le mot de passe doit contenir au moins 8 caractères.";
      else msg = msg.charAt(0).toUpperCase() + msg.slice(1);
      throw new Error(msg);
    }
    // Pas de session renvoyée → confirmation email requise
    if (!j.access_token) {
      const err = new Error("Compte créé ! Vérifiez votre boîte email pour confirmer votre adresse.");
      err.code = "email-confirmation-required";
      throw err;
    }
    // Session immédiate (confirmation désactivée) → connexion classique
    await init().catch(function() {});
    return await login(data.email, data.password);
  }

  async function forgotPassword(email) {
    // Appel REST direct (pas de client Supabase → jamais de blocage)
    const res = await fetch(SA_CONFIG.url + "/auth/v1/recover?redirect_to=" + encodeURIComponent("https://sansagents.fr/reset-password"), {
      method: "POST",
      headers: { "apikey": SA_CONFIG.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });
    if (!res.ok) {
      let msg = "Erreur lors de l'envoi de l'email.";
      try {
        const j = await res.json();
        msg = j.msg || j.error_description || j.message || msg;
        if (/rate limit|security purposes/i.test(msg)) msg = "Trop de demandes — patientez une minute puis réessayez.";
      } catch(e) {}
      throw new Error(msg);
    }
  }

  async function updatePassword(newPassword) {
    const { error } = await _sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function getRecoverySession() {
    const { data: { session } } = await _sb.auth.getSession();
    return session;
  }

  async function logout() {
    await _sb.auth.signOut();
    _cache.user          = null;
    _cache.favorites     = [];
    _cache.favoritesData = [];
    _cache.conversations = [];
    _cache.searches      = [];
    mountNavAuth();
  }

  async function updateUser(patch) {
    if (!_cache.user) return null;
    const dbPatch = {};
    if (patch.prenom !== undefined) dbPatch.prenom = patch.prenom;
    if (patch.nom    !== undefined) dbPatch.nom    = patch.nom;
    if (patch.email  !== undefined) dbPatch.email  = patch.email;
    if (patch.photo  !== undefined && patch.photo && patch.photo.startsWith("data:")) {
      const url = await _uploadPhoto(patch.photo);
      if (url) dbPatch.photo = url;
    } else if (patch.photo !== undefined) {
      dbPatch.photo = patch.photo;
    }
    const { error } = await _sb.from("profiles").update(dbPatch).eq("id", _cache.user.id);
    if (error) throw error;
    Object.assign(_cache.user, dbPatch);
    mountNavAuth();
    return _cache.user;
  }

  /* ── Coordonnées (endpoint sécurisé) ─────────────────────────────── */
  async function getListingContact(listingId) {
    if (!_sb || !_cache.user) return null;
    const { data } = await _sb.rpc("get_listing_contact", { p_listing_id: listingId });
    return data && data[0] ? data[0] : null;
  }

  /* ── Toast ──────────────────────────────────────────────────────── */
  function ensureToastRoot() {
    let root = document.getElementById("saToastRoot");
    if (root) return root;
    root = document.createElement("div");
    root.id = "saToastRoot";
    root.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none";
    document.body.appendChild(root);
    return root;
  }
  function toast(msg, icon) {
    const root = ensureToastRoot();
    const el = document.createElement("div");
    el.style.cssText = "background:#111;color:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13.5px;padding:11px 18px;border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,0.25);display:flex;align-items:center;gap:8px;opacity:0;transition:opacity .2s, transform .2s;transform:translateY(8px)";
    el.innerHTML = (icon ? '<i class="ti ' + icon + '" style="color:#ff7a68;font-size:15px"></i>' : "") + "<span>" + escapeHtml(msg) + "</span>";
    root.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 2400);
  }

  /* ── Carte d'annonce ────────────────────────────────────────────── */
  const IMG_GRADIENTS = {
    lyon:"linear-gradient(135deg,#4f6d9e,#7890b8)",bordeaux:"linear-gradient(135deg,#8b5a5a,#b87070)",
    paris:"linear-gradient(135deg,#4a7c6b,#6aaa90)",lille:"linear-gradient(135deg,#6b6b8b,#9090b0)",
    p0:"linear-gradient(135deg,#4f6d9e,#7890b8)",p1:"linear-gradient(135deg,#8b5a5a,#b87070)",
    p2:"linear-gradient(135deg,#4a7c6b,#6aaa90)",p3:"linear-gradient(135deg,#6b6b8b,#9090b0)",
    p4:"linear-gradient(135deg,#9e7d4f,#c4a878)",p5:"linear-gradient(135deg,#5a8b7a,#7fb8a3)",
    p6:"linear-gradient(135deg,#7a5a8b,#a378b8)",p7:"linear-gradient(135deg,#8b7a4f,#c4ab78)"
  };
  function cardHTML(listing) {
    const fav = isFavorite(listing.id);
    const photos = Array.isArray(listing.photos) ? listing.photos : [];
    const mainPhoto = photos[0] ? (photos[0].url || photos[0]) : null;
    const grad = IMG_GRADIENTS[listing.img] || IMG_GRADIENTS.p0;
    const icon = TYPE_ICONS[listing.type] || "ti-home";
    const badgeClass = listing.transaction === "vente" ? "vente" : "location";
    const badgeLabel = listing.transaction === "vente" ? "Vente" : "Location";
    return (
      '<div class="sa-listing-card" onclick="SA.openListing(\'' + listing.id + '\')">' +
        '<div class="sa-listing-img" style="' + (mainPhoto ? "background-image:url('" + mainPhoto + "');background-size:cover;background-position:center" : "background:" + grad) + '">' +
          '<span class="sa-listing-badge ' + badgeClass + '">' + badgeLabel + "</span>" +
          '<button class="sa-listing-fav' + (fav ? " active" : "") + '" onclick="event.stopPropagation();SA.toggleFavoriteUI(this,\'' + listing.id + "')\"><i class=\"ti ti-heart" + (fav ? "-filled" : "") + '"></i></button>' +
          (mainPhoto ? "" : '<i class="ti ' + icon + '"></i>') +
        "</div>" +
        '<div class="sa-listing-body">' +
          '<div class="sa-listing-price">' + fmtPriceTransaction(listing) + "</div>" +
          '<div class="sa-listing-title">' + escapeHtml(listing.title) + "</div>" +
          '<div class="sa-listing-meta"><span><i class="ti ti-ruler-2"></i> ' + listing.surface + ' m²</span><span><i class="ti ti-door"></i> ' + (listing.pieces || "—") + " pièce" + (listing.pieces > 1 ? "s" : "") + "</span></div>" +
        "</div>" +
      "</div>"
    );
  }

  /* ── Modale / Navigation ────────────────────────────────────────── */
  function listingSlug(l) {
    if (!l) return "";
    var parts = [];
    if (l.transaction) parts.push(l.transaction === "vente" ? "vente" : "location");
    if (l.type) parts.push(l.type.replace(/\s*\/.*/, "").replace(/[^a-z0-9]/gi, "-").toLowerCase());
    if (l.ville) parts.push(l.ville.replace(/[^a-z0-9]/gi, "-").toLowerCase());
    if (l.postal) parts.push(l.postal);
    parts.push(l.id.substring(0, 8));
    return parts.join("-");
  }
  function openListing(id) {
    window.location.href = "annonce?id=" + encodeURIComponent(id);
  }
  function closeListing() {
    const root = document.getElementById("saListingModalRoot");
    if (root) root.innerHTML = "";
  }
  async function toggleFavoriteModal(btn, id) {
    const nowFav = await toggleFavorite(id);
    btn.classList.toggle("active", nowFav);
    btn.querySelector("i").className = "ti " + (nowFav ? "ti-heart-filled" : "ti-heart");
    if (typeof window.refreshGrid === "function") window.refreshGrid();
    toast(nowFav ? "Ajouté à vos favoris" : "Retiré de vos favoris", nowFav ? "ti-heart-filled" : "ti-heart");
  }
  function revealContact(btn) {
    const info = document.getElementById("saContactInfo");
    if (info) info.classList.add("show");
    if (btn) btn.style.display = "none";
  }
  function mockContact() {
    toast("Cette annonce de démonstration n'a pas de propriétaire réel.", "ti-info-circle");
  }

  /* ── Badges / navigation ────────────────────────────────────────── */
  function mountFavBadge() {
    document.querySelectorAll("[data-nav-fav-badge]").forEach(b => {
      const n = _cache.favorites.length;
      b.textContent = n > 9 ? "9+" : String(n);
      b.style.display = n > 0 ? "flex" : "none";
    });
  }
  function mountMsgBadge() {
    document.querySelectorAll("[data-nav-msg-badge]").forEach(b => {
      const n = getUnreadMessageCount();
      b.textContent = n > 9 ? "9+" : String(n);
      b.style.display = n > 0 ? "flex" : "none";
    });
  }
  function mountNavAuth() {
    const user = _cache.user;
    document.querySelectorAll("[data-nav-account]").forEach(wrap => {
      if (wrap.dataset.saDefault === undefined) wrap.dataset.saDefault = wrap.innerHTML;
      wrap.innerHTML = wrap.dataset.saDefault;
      const btn      = wrap.querySelector(".sa-nav-icon-btn");
      const icon     = btn.querySelector("i");
      const label    = btn.querySelector(".sa-nav-icon-label");
      const dropdown = wrap.querySelector(".sa-account-dropdown");
      if (user) {
        if (user.photo) {
          icon.outerHTML = '<span class="sa-nav-avatar" style="background-image:url(\'' + user.photo + '\');background-size:cover;background-position:center"></span>';
        } else {
          icon.outerHTML = '<span class="sa-nav-avatar">' + escapeHtml((user.prenom || "?").charAt(0).toUpperCase()) + "</span>";
        }
        label.textContent = user.prenom || "Mon compte";
        btn.onclick = function(e) { e.stopPropagation(); dropdown.classList.toggle("show"); };
        dropdown.innerHTML =
          '<div class="sa-account-dropdown-email"><i class="ti ti-user-circle"></i> ' + escapeHtml(user.email || "") + "</div>" +
          '<button class="sa-account-dropdown-logout" style="color:#333" onclick="window.location.href=\'profil\'"><i class="ti ti-user-circle"></i> Mon profil</button>' +
          '<button class="sa-account-dropdown-logout" style="color:#333" onclick="window.location.href=\'mes-annonces\'"><i class="ti ti-home"></i> Mes annonces' + (getUserListings().length > 0 ? ' <span style="margin-left:6px;background:#E84533;color:white;font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px">' + getUserListings().length + '</span>' : '') + '</button>' +
          '<button class="sa-account-dropdown-logout" style="color:#333" onclick="window.location.href=\'documents\'"><i class="ti ti-files"></i> Mes documents' + (function(){ var n = getDocs().length; try { n += JSON.parse(localStorage.getItem("sa_buyer_docs_" + user.id) || "[]").length; } catch(e) {} return n > 0 ? ' <span style="margin-left:6px;background:#E84533;color:white;font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px">' + n + '</span>' : ''; })() + '</button>' +
          '<button class="sa-account-dropdown-logout" onclick="SA.logout()"><i class="ti ti-logout"></i> Se déconnecter</button>';
      } else {
        btn.onclick = function() {
          window.location.href = "connexion?redirect=" + encodeURIComponent(window.location.pathname.split("/").pop() || "./");
        };
      }
    });
    mountFavBadge();
    mountMsgBadge();
  }
  document.addEventListener("click", function(e) {
    document.querySelectorAll(".sa-account-dropdown.show").forEach(d => {
      if (!d.parentElement.contains(e.target)) d.classList.remove("show");
    });
  });

  /* ── Navigation mobile (bottom tab bar + hamburger droit) ──────── */
  function initMobileNav() {
    if (window.innerWidth > 768) return;
    if (document.querySelector(".sa-bottom-nav")) return;
    // Pages au design mobile dédié (m/) : elles ont leur propre navigation
    if (document.querySelector(".m-nav") || document.querySelector(".m-bottom-nav")) return;

    var user = _cache.user;
    var msgN = getUnreadMessageCount();
    var favN = _cache.favorites.length;
    var path = window.location.pathname;

    function isActive(href) {
      if (href === "./") return path === "/" || path === "/index.html" || path === "./";
      return path.indexOf(href.replace("./","")) !== -1;
    }

    // ── Bottom nav ──
    var bar = document.createElement("nav");
    bar.className = "sa-bottom-nav";
    bar.innerHTML =
      _navTab("./", "ti-home", "Accueil", isActive("./")) +
      _navTab("annonces", "ti-building-estate", "Annonces", isActive("annonces")) +
      '<button class="sa-bottom-nav-cta" onclick="window.location.href=\'deposer\'">' +
        '<div class="sa-bottom-nav-cta-circle"><i class="ti ti-plus"></i></div>' +
        '<span>Déposer</span>' +
      '</button>' +
      _navTabBadge("messages", "ti-message-2", "Messages", isActive("messages"), msgN) +
      _navTabUser(user, isActive("profil") || isActive("connexion"));
    document.body.appendChild(bar);
    document.body.classList.add("sa-has-bottom-nav");

    // ── Hamburger bouton (top-right) ──
    var nav = document.querySelector(".sa-nav");
    if (nav && !document.querySelector(".sa-hamburger")) {
      var btn = document.createElement("button");
      btn.className = "sa-hamburger";
      btn.setAttribute("aria-label", "Menu");
      btn.innerHTML = "<span></span><span></span><span></span>";
      nav.appendChild(btn);

      // Overlay
      var overlay = document.createElement("div");
      overlay.className = "sa-mobile-menu-overlay";
      document.body.appendChild(overlay);

      // Menu panneau droit
      var menu = document.createElement("div");
      menu.className = "sa-mobile-menu";
      menu.innerHTML =
        '<div class="sa-mobile-menu-section">Navigation</div>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'./\'"><i class="ti ti-home"></i> Accueil</button>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'annonces\'"><i class="ti ti-building-estate"></i> Annonces</button>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'/m/vendre\'"><i class="ti ti-book-2"></i> Guide</button>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'professionnels\'"><i class="ti ti-briefcase"></i> Professionnels</button>' +
        '<div class="sa-mobile-menu-divider"></div>' +
        '<div class="sa-mobile-menu-section">Mon espace</div>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'favoris\'"><i class="ti ti-heart"></i> Favoris' + (favN > 0 ? ' <span style="margin-left:auto;background:#E84533;color:white;font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px">' + favN + '</span>' : '') + '</button>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'messages\'"><i class="ti ti-message-2"></i> Messages' + (msgN > 0 ? ' <span style="margin-left:auto;background:#E84533;color:white;font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px">' + msgN + '</span>' : '') + '</button>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'recherches\'"><i class="ti ti-search"></i> Mes recherches</button>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'mes-annonces\'"><i class="ti ti-home-edit"></i> Mes annonces</button>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'documents\'"><i class="ti ti-files"></i> Mes documents</button>' +
        '<div class="sa-mobile-menu-divider"></div>' +
        '<button class="sa-mobile-menu-item" onclick="window.location.href=\'contact\'"><i class="ti ti-mail"></i> Nous contacter</button>' +
        '<div class="sa-mobile-menu-divider"></div>' +
        (user
          ? '<button class="sa-mobile-menu-item" onclick="window.location.href=\'profil\'"><i class="ti ti-user-circle"></i> ' + escapeHtml(user.prenom || "Mon profil") + '</button>' +
            '<button class="sa-mobile-menu-item" style="color:#c0392b" onclick="SA.logout()"><i class="ti ti-logout" style="color:#c0392b"></i> Se déconnecter</button>'
          : '<button class="sa-mobile-menu-item" onclick="window.location.href=\'connexion\'"><i class="ti ti-login-2"></i> Se connecter</button>'
        );
      document.body.appendChild(menu);

      function openMenu() {
        btn.classList.add("open");
        menu.classList.add("open");
        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
      }
      function closeMenu() {
        btn.classList.remove("open");
        menu.classList.remove("open");
        overlay.classList.remove("open");
        document.body.style.overflow = "";
      }
      btn.addEventListener("click", function() {
        menu.classList.contains("open") ? closeMenu() : openMenu();
      });
      overlay.addEventListener("click", closeMenu);
      menu.querySelectorAll(".sa-mobile-menu-item").forEach(function(item) {
        item.addEventListener("click", closeMenu);
      });
    }
  }

  function _navTab(href, icon, label, active) {
    return '<button class="sa-bottom-nav-tab' + (active ? ' active' : '') + '" onclick="window.location.href=\'' + href + '\'">' +
      '<i class="ti ' + icon + '"></i><span>' + label + '</span></button>';
  }
  function _navTabBadge(href, icon, label, active, count) {
    return '<button class="sa-bottom-nav-tab' + (active ? ' active' : '') + '" onclick="window.location.href=\'' + href + '\'">' +
      '<div style="position:relative;display:inline-flex">' +
        '<i class="ti ' + icon + '"></i>' +
        (count > 0 ? '<span class="sa-bottom-nav-badge">' + count + '</span>' : '') +
      '</div><span>' + label + '</span></button>';
  }
  function _navTabUser(user, active) {
    if (user) {
      return '<button class="sa-bottom-nav-tab' + (active ? ' active' : '') + '" onclick="window.location.href=\'profil\'">' +
        '<div class="sa-bottom-nav-avatar">' + escapeHtml((user.prenom || "U").charAt(0).toUpperCase()) + '</div>' +
        '<span>Profil</span></button>';
    }
    return '<button class="sa-bottom-nav-tab' + (active ? ' active' : '') + '" onclick="window.location.href=\'connexion\'">' +
      '<i class="ti ti-user"></i><span>Connexion</span></button>';
  }

  /* ── API publique ────────────────────────────────────────────────── */
  window.SA = {
    TYPE_LABELS, TYPE_ICONS, DEMO_LISTINGS, DEMO_PROS, IMG_GRADIENTS,
    fmtPrice, fmtPriceTransaction, parseAddress, piecesFromSelect, dpeLetterFrom, escapeHtml, titleFor,
    compressImageFile, hasEquip, containsContactInfo,
    init,
    // Annonces
    getAllListings, getListingById, getUserListings, addListing, updateListing,
    // Favoris
    getFavorites, getFavoritesData, isFavorite, toggleFavorite, toggleFavoriteUI,
    // Recherches
    getSavedSearches, addSavedSearch, removeSavedSearch,
    // Messagerie
    getConversations, getConversation, getConversationByListing, hasConversation,
    sendMessage, setContactShared, setBuyerConfirmedSale,
    markConversationRead, deleteConversation, getUnreadMessageCount,
    getListingContact,
    // Pros
    getAllPros, getProById, getUserPros, addPro, setProVerified,
    // Documents
    saveDoc, getDocs, deleteDoc,
    // Auth
    getUser, login, signup, logout, updateUser, forgotPassword, updatePassword, getRecoverySession,
    // UI
    toast, cardHTML, openListing, closeListing, toggleFavoriteModal,
    revealContact, mockContact, mountNavAuth, mountFavBadge, mountMsgBadge,
    initMobileNav
  };

  // Ctrl+clic / clic milieu sur les boutons de nav → ouvre dans un nouvel onglet
  // Phase de capture (true) = s'exécute AVANT le onclick inline du bouton
  document.addEventListener("click", function(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    var btn = e.target.closest(".sa-nav-link[onclick],.sa-nav-cta[onclick]");
    if (!btn) return;
    var m = btn.getAttribute("onclick").match(/href=['"]([^'"]+)['"]/);
    if (!m) return;
    e.stopPropagation();
    e.preventDefault();
    window.open(m[1], "_blank");
  }, true);
  document.addEventListener("auxclick", function(e) {
    if (e.button !== 1) return;
    var btn = e.target.closest(".sa-nav-link[onclick],.sa-nav-cta[onclick]");
    if (!btn) return;
    var m = btn.getAttribute("onclick").match(/href=['"]([^'"]+)['"]/);
    if (!m) return;
    e.preventDefault();
    window.open(m[1], "_blank");
  }, true);

  // Démarre automatiquement (sans bloquer le rendu de la page)
  document.addEventListener("DOMContentLoaded", function() {
    init().then(function() { initMobileNav(); });
  });
})();
