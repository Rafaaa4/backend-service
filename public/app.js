// State Management
let currentRole = 'client';
let currentUser = null;
let currentToken = null;
let categories = [];
let providers = [];
let activeCategory = null;
let selectedProvider = null;
let selectedSlot = null;
let activeChatBookingId = null;
let activePaymentBooking = null;
let socket = null;

// Demo accounts for instant seamless role switching
const DEMO_ACCOUNTS = {
  client: { email: 'client@test.tn', password: 'ClientPass123!' },
  provider: { email: 'sami.electricien@homeservices.tn', password: 'ProviderPass123!' },
  admin: { email: 'admin@homeservices.tn', password: 'AdminPass123!' }
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Set default booking date to tomorrow
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  document.getElementById('booking-date').value = tomorrow.toISOString().split('T')[0];

  // Start in client mode
  await switchRole('client');
});

// Switch Active Demo Role
async function switchRole(role) {
  currentRole = role;

  // Update navbar role buttons
  document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`btn-role-${role}`).classList.add('active');

  // Update views
  document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
  document.getElementById(`view-${role}`).classList.add('active');

  // Authenticate as role
  try {
    const creds = DEMO_ACCOUNTS[role];
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });

    const data = await res.json();
    if (data.success) {
      currentUser = data.data.user;
      currentToken = data.data.accessToken;
      document.getElementById('user-name').innerText = currentUser.fullName;

      // Reconnect Socket.IO with new auth token
      initSocketConnection(currentToken);

      // Load role-specific data
      if (role === 'client') {
        await loadCategories();
        await loadProviders();
        await loadClientBookings();
      } else if (role === 'provider') {
        await loadProviderBookings();
      } else if (role === 'admin') {
        await loadAdminDashboard();
      }

      showToast(`Connecté en tant que ${currentUser.fullName} (${currentUser.role})`);
    } else {
      showToast('Erreur de connexion : ' + (data.error?.message || 'Inconnue'), true);
    }
  } catch (err) {
    showToast('Erreur réseau : ' + err.message, true);
  }
}

// Socket.IO Setup
function initSocketConnection(token) {
  if (socket) {
    socket.disconnect();
  }

  socket = io({
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('Socket.IO connected for user:', currentUser?.fullName);
  });

  socket.on('new_message', (message) => {
    if (activeChatBookingId === message.bookingId) {
      appendChatMessage(message);
    }
  });
}

// ==================== CLIENT JOURNEY ====================

async function loadCategories() {
  try {
    const res = await fetch('/api/v1/categories');
    const json = await res.json();
    if (json.success) {
      categories = json.data;
      renderCategoryPills();
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  container.innerHTML = `
    <button class="pill ${!activeCategory ? 'active' : ''}" onclick="filterCategory(null)">
      <span class="material-symbols-outlined">apps</span> Toutes les catégories
    </button>
  `;

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `pill ${activeCategory === cat._id ? 'active' : ''}`;
    btn.innerHTML = `<span class="material-symbols-outlined">${cat.icon || 'build'}</span> ${cat.name}`;
    btn.onclick = () => filterCategory(cat._id);
    container.appendChild(btn);
  });
}

function filterCategory(catId) {
  activeCategory = catId;
  renderCategoryPills();
  loadProviders();
}

async function loadProviders() {
  try {
    let url = '/api/v1/providers';
    if (activeCategory) {
      url += `?categoryId=${activeCategory}`;
    }

    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      providers = json.data.providers;
      renderProviders();
    }
  } catch (err) {
    console.error('Error loading providers:', err);
  }
}

function renderProviders() {
  const container = document.getElementById('providers-grid');
  document.getElementById('provider-count').innerText = `${providers.length} professionnels trouvés`;

  if (providers.length === 0) {
    container.innerHTML = '<p class="text-muted">Aucun prestataire vérifié trouvé dans cette catégorie.</p>';
    return;
  }

  container.innerHTML = providers.map(p => `
    <div class="provider-card">
      <div class="card-top">
        <div class="provider-avatar">${p.userId?.fullName?.charAt(0) || 'P'}</div>
        <div class="provider-info">
          <h3>${p.businessName}</h3>
          <div class="verified-tag">
            <span class="material-symbols-outlined">verified</span> Vérifié par Admin
          </div>
          <br>
          <div class="rating-badge">★ ${p.ratingAvg.toFixed(1)} (${p.ratingCount} avis)</div>
        </div>
      </div>
      <p class="provider-bio">${p.bio || 'Professionnel certifié en services à domicile.'}</p>
      <div class="card-footer">
        <div class="price-tag">
          ${(p.hourlyRate / 1000).toFixed(3)} <small>TND / heure</small>
        </div>
        <button class="btn btn-primary" onclick="openBookingModal('${p._id}')">
          <span class="material-symbols-outlined">event_available</span> Réserver
        </button>
      </div>
    </div>
  `).join('');
}

async function openBookingModal(providerId) {
  selectedProvider = providers.find(p => p._id === providerId);
  if (!selectedProvider) return;

  document.getElementById('booking-modal-title').innerText = `Réserver avec ${selectedProvider.businessName}`;
  document.getElementById('booking-modal').classList.add('open');
  await loadProviderSlots();
}

async function loadProviderSlots() {
  const dateStr = document.getElementById('booking-date').value;
  const container = document.getElementById('slots-container');
  const btnSubmit = document.getElementById('btn-submit-booking');
  btnSubmit.disabled = true;
  selectedSlot = null;

  if (!dateStr || !selectedProvider) return;

  container.innerHTML = '<span class="placeholder-text">Chargement des disponibilités en temps réel...</span>';

  try {
    const res = await fetch(`/api/v1/providers/${selectedProvider.userId._id || selectedProvider.userId}/availability?date=${dateStr}`);
    const json = await res.json();

    if (json.success && json.data.slots.length > 0) {
      container.innerHTML = json.data.slots.map(s => {
        const timeLabel = new Date(s.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        if (s.available) {
          return `<button class="slot-btn available" onclick="selectSlot('${s.startAt}', this)">${timeLabel}</button>`;
        } else {
          return `<button class="slot-btn disabled" disabled title="Créneau déjà réservé">${timeLabel} (Occupé)</button>`;
        }
      }).join('');
    } else {
      container.innerHTML = '<span class="placeholder-text">Aucun créneau disponible ce jour (Congé ou complet).</span>';
    }
  } catch (err) {
    container.innerHTML = '<span class="placeholder-text text-danger">Erreur lors de la récupération des créneaux.</span>';
  }
}

function selectSlot(slotIso, el) {
  selectedSlot = slotIso;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('btn-submit-booking').disabled = false;

  // Price Preview (20% deposit)
  const service = selectedProvider.serviceIds?.[0] || { basePrice: 40000 };
  const total = service.basePrice;
  const deposit = Math.round(total * 0.20);
  const remaining = total - deposit;

  document.getElementById('booking-price-preview').innerHTML = `
    <strong>Récapitulatif financier figé :</strong><br>
    Montant total prestation : <strong>${(total / 1000).toFixed(3)} TND</strong><br>
    Acompte de réservation (20%) : <strong style="color: var(--primary);">${(deposit / 1000).toFixed(3)} TND</strong><br>
    Solde restant à régler après service : ${(remaining / 1000).toFixed(3)} TND
  `;
}

async function submitBooking() {
  if (!selectedProvider || !selectedSlot) return;

  const address = document.getElementById('booking-address').value;
  const clientNotes = document.getElementById('booking-notes').value;
  const serviceId = selectedProvider.serviceIds?.[0]?._id;

  if (!serviceId) {
    showToast('Erreur: aucun service associé trouvé', true);
    return;
  }

  try {
    const res = await fetch('/api/v1/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
        'Idempotency-Key': `booking-req-${Date.now()}`
      },
      body: JSON.stringify({
        providerId: selectedProvider.userId._id || selectedProvider.userId,
        serviceId,
        startAt: selectedSlot,
        address: { street: address, city: 'Tunis' },
        clientNotes
      })
    });

    const json = await res.json();
    if (json.success) {
      closeModal('booking-modal');
      showToast('Créneau verrouillé avec succès ! Procédez au paiement de l’acompte.');
      openPaymentModal(json.data);
      await loadClientBookings();
    } else {
      showToast('Échec de la réservation : ' + (json.error?.message || 'Erreur inconnue'), true);
    }
  } catch (err) {
    showToast('Erreur réseau : ' + err.message, true);
  }
}

async function loadClientBookings() {
  try {
    const res = await fetch('/api/v1/bookings/me', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const json = await res.json();
    if (json.success) {
      renderClientBookings(json.data.bookings);
    }
  } catch (err) {
    console.error('Error loading client bookings:', err);
  }
}

function renderClientBookings(bookings) {
  const container = document.getElementById('client-bookings-list');
  if (!bookings || bookings.length === 0) {
    container.innerHTML = '<p class="text-muted">Vous n’avez aucune réservation pour le moment.</p>';
    return;
  }

  container.innerHTML = bookings.map(b => `
    <div class="booking-card">
      <div class="booking-header">
        <span class="booking-status status-${b.status}">${formatStatus(b.status)}</span>
        <strong>${(b.priceSnapshot?.totalAmount / 1000).toFixed(3)} TND</strong>
      </div>
      <div class="booking-details">
        <div class="booking-row">
          <span class="material-symbols-outlined">engineering</span>
          <strong>${b.providerId?.fullName || 'Prestataire'}</strong> (${b.serviceId?.name || 'Prestation'})
        </div>
        <div class="booking-row">
          <span class="material-symbols-outlined">calendar_today</span>
          ${new Date(b.startAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
        <div class="booking-row">
          <span class="material-symbols-outlined">location_on</span>
          ${b.address?.street || 'Adresse non spécifiée'}
        </div>
      </div>
      <div class="booking-actions">
        ${b.status === 'PENDING_PAYMENT' ? `
          <button class="btn btn-primary" onclick='openPaymentModal(${JSON.stringify(b)})'>
            <span class="material-symbols-outlined">credit_card</span> Payer l’acompte
          </button>
        ` : ''}
        <button class="btn btn-secondary" onclick="openChatModal('${b._id}')">
          <span class="material-symbols-outlined">chat</span> Discuter
        </button>
        ${b.status === 'COMPLETED' ? `
          <button class="btn btn-success" onclick="openReviewModal('${b._id}')">
            <span class="material-symbols-outlined">star</span> Évaluer
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// ==================== PAYMENT MODAL ====================

function openPaymentModal(booking) {
  activePaymentBooking = booking;
  const deposit = booking.priceSnapshot?.depositAmount || 8000;
  const total = booking.priceSnapshot?.totalAmount || 40000;

  document.getElementById('payment-details-box').innerHTML = `
    <div style="font-size: 1.1rem; margin-bottom: 8px;">
      Montant de l'acompte à régler : <strong style="color: var(--primary);">${(deposit / 1000).toFixed(3)} TND</strong>
    </div>
    <div style="color: var(--text-muted); font-size: 0.85rem;">
      Prestation : ${booking.serviceId?.name || 'Service à domicile'}<br>
      Total de la prestation : ${(total / 1000).toFixed(3)} TND<br>
      Fournisseur sandbox : Passerelle Flouci / Konnect
    </div>
  `;

  document.getElementById('payment-modal').classList.add('open');
}

async function simulatePayment(isSuccess) {
  if (!activePaymentBooking) return;

  try {
    // 1. Initiate checkout to get transactionRef
    const checkoutRes = await fetch('/api/v1/payments/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ bookingId: activePaymentBooking._id })
    });

    const checkoutJson = await checkoutRes.json();
    if (!checkoutJson.success) {
      showToast('Erreur création paiement: ' + checkoutJson.error?.message, true);
      return;
    }

    const transactionRef = checkoutJson.data.transactionReference;

    // 2. Simulate signed webhook
    const webhookRes = await fetch('/api/v1/payments/mock-simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionReference: transactionRef, success: isSuccess })
    });

    const webhookJson = await webhookRes.json();
    closeModal('payment-modal');

    if (isSuccess) {
      showToast('Paiement confirmé par Webhook ! Réservation envoyée au prestataire.');
    } else {
      showToast('Paiement échoué. Le créneau a été libéré.', true);
    }

    await loadClientBookings();
  } catch (err) {
    showToast('Erreur paiement : ' + err.message, true);
  }
}

// ==================== PROVIDER JOURNEY ====================

async function loadProviderBookings() {
  try {
    const res = await fetch('/api/v1/bookings/me', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const json = await res.json();
    if (json.success) {
      const bookings = json.data.bookings;
      const activeCount = bookings.filter(b => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)).length;
      document.getElementById('p-active-count').innerText = activeCount;
      renderProviderBookings(bookings);
    }
  } catch (err) {
    console.error('Error loading provider bookings:', err);
  }
}

function renderProviderBookings(bookings) {
  const container = document.getElementById('provider-bookings-list');
  if (!bookings || bookings.length === 0) {
    container.innerHTML = '<p class="text-muted">Aucune demande de mission reçue.</p>';
    return;
  }

  container.innerHTML = bookings.map(b => `
    <div class="booking-card">
      <div class="booking-header">
        <span class="booking-status status-${b.status}">${formatStatus(b.status)}</span>
        <strong>Acompte payé : ${(b.priceSnapshot?.depositAmount / 1000).toFixed(3)} TND</strong>
      </div>
      <div class="booking-details">
        <div class="booking-row">
          <span class="material-symbols-outlined">person</span>
          <strong>Client :</strong> ${b.clientId?.fullName || 'Client'} (${b.clientId?.phone || 'Téléphone masqué'})
        </div>
        <div class="booking-row">
          <span class="material-symbols-outlined">calendar_today</span>
          ${new Date(b.startAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
        <div class="booking-row">
          <span class="material-symbols-outlined">location_on</span>
          ${b.address?.street || 'Adresse client'}
        </div>
        ${b.clientNotes ? `<div class="booking-row"><span class="material-symbols-outlined">notes</span> <em>"${b.clientNotes}"</em></div>` : ''}
      </div>
      <div class="booking-actions">
        ${b.status === 'AWAITING_PROVIDER' ? `
          <button class="btn btn-success" onclick="updateBookingStatus('${b._id}', 'accept')">
            <span class="material-symbols-outlined">check</span> Accepter la mission
          </button>
          <button class="btn btn-danger" onclick="updateBookingStatus('${b._id}', 'reject')">
            <span class="material-symbols-outlined">close</span> Refuser
          </button>
        ` : ''}
        ${b.status === 'CONFIRMED' ? `
          <button class="btn btn-primary" onclick="updateBookingStatus('${b._id}', 'start')">
            <span class="material-symbols-outlined">play_arrow</span> Démarrer l'intervention
          </button>
        ` : ''}
        ${b.status === 'IN_PROGRESS' ? `
          <button class="btn btn-success" onclick="updateBookingStatus('${b._id}', 'complete')">
            <span class="material-symbols-outlined">task_alt</span> Marquer terminée
          </button>
        ` : ''}
        <button class="btn btn-secondary" onclick="openChatModal('${b._id}')">
          <span class="material-symbols-outlined">chat</span> Contacter le client
        </button>
      </div>
    </div>
  `).join('');
}

async function updateBookingStatus(bookingId, action) {
  try {
    const res = await fetch(`/api/v1/bookings/${bookingId}/${action}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({})
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Statut de la mission mis à jour : ${formatStatus(json.data.status)}`);
      await loadProviderBookings();
    } else {
      showToast('Erreur : ' + (json.error?.message || 'Action impossible'), true);
    }
  } catch (err) {
    showToast('Erreur réseau : ' + err.message, true);
  }
}

// ==================== ADMIN BACK-OFFICE ====================

async function loadAdminDashboard() {
  try {
    // 1. Load Metrics
    const metricsRes = await fetch('/api/v1/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const metricsJson = await metricsRes.json();
    if (metricsJson.success) {
      const data = metricsJson.data;
      document.getElementById('kpi-clients').innerText = data.users.totalClients;
      document.getElementById('kpi-providers').innerText = data.users.verifiedProviders;
      document.getElementById('kpi-bookings').innerText = data.bookings.total;
      document.getElementById('kpi-revenue').innerText = `${(data.finances.totalProcessedMillimes / 1000).toFixed(3)} TND`;
    }

    // 2. Load Pending KYC
    const kycRes = await fetch('/api/v1/admin/providers/pending', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const kycJson = await kycRes.json();
    if (kycJson.success) {
      renderKycTable(kycJson.data);
    }

    // 3. Load Audit Logs
    const auditRes = await fetch('/api/v1/admin/audit-logs', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const auditJson = await auditRes.json();
    if (auditJson.success) {
      renderAuditTable(auditJson.data.logs);
    }
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
  }
}

function renderKycTable(pendingList) {
  const container = document.getElementById('kyc-table-container');
  if (!pendingList || pendingList.length === 0) {
    container.innerHTML = '<div style="padding: 1.5rem; color: var(--text-muted);">Aucun dossier en attente d’approbation KYC. Tous les prestataires sont vérifiés.</div>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Professionnel</th>
          <th>Métier</th>
          <th>Documents Soumis</th>
          <th>Date de demande</th>
          <th>Actions de vérification</th>
        </tr>
      </thead>
      <tbody>
        ${pendingList.map(p => `
          <tr>
            <td>
              <strong>${p.businessName}</strong><br>
              <small class="text-muted">${p.userId?.fullName} (${p.userId?.phone || 'N/A'})</small>
            </td>
            <td>${p.categoryIds?.[0]?.name || 'Réparation'}</td>
            <td>
              <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">description</span>
              ${p.documents?.[0]?.docType || 'CIN / Pièce d’identité'} (Vérifié anti-malware)
            </td>
            <td>${new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
            <td>
              <button class="btn btn-success" style="padding: 6px 12px; font-size: 0.8rem;" onclick="verifyProvider('${p.userId._id || p.userId}', 'VERIFIED')">
                <span class="material-symbols-outlined">check_circle</span> Approuver
              </button>
              <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="verifyProvider('${p.userId._id || p.userId}', 'REJECTED')">
                <span class="material-symbols-outlined">cancel</span> Rejeter
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function verifyProvider(providerId, status) {
  try {
    const res = await fetch(`/api/v1/admin/providers/${providerId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ status, reason: 'Vérification KYC effectuée par l’administrateur' })
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Dossier prestataire ${status === 'VERIFIED' ? 'approuvé et publié' : 'rejeté'}`);
      await loadAdminDashboard();
    } else {
      showToast('Erreur : ' + (json.error?.message || 'Échec de la validation'), true);
    }
  } catch (err) {
    showToast('Erreur réseau : ' + err.message, true);
  }
}

function renderAuditTable(logs) {
  const container = document.getElementById('audit-table-container');
  if (!logs || logs.length === 0) {
    container.innerHTML = '<div style="padding: 1.5rem; color: var(--text-muted);">Aucune opération enregistrée.</div>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Horodatage</th>
          <th>Acteur</th>
          <th>Action</th>
          <th>Ressource</th>
          <th>Détails</th>
        </tr>
      </thead>
      <tbody>
        ${logs.slice(0, 10).map(l => `
          <tr>
            <td><small>${new Date(l.createdAt).toLocaleTimeString('fr-FR')}</small></td>
            <td><strong>${l.actorId?.fullName || 'Système'}</strong> <small>(${l.actorId?.role})</small></td>
            <td><code>${l.action}</code></td>
            <td>${l.resourceType}</td>
            <td><small>${JSON.stringify(l.details || {})}</small></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ==================== REAL-TIME CHAT ====================

async function openChatModal(bookingId) {
  activeChatBookingId = bookingId;
  document.getElementById('chat-modal').classList.add('open');
  document.getElementById('chat-messages').innerHTML = '<div style="color: var(--text-muted); text-align: center;">Chargement de la conversation...</div>';

  if (socket) {
    socket.emit('join_conversation', { bookingId });
  }

  try {
    const res = await fetch(`/api/v1/conversations/${bookingId}/messages`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const json = await res.json();
    if (json.success) {
      renderChatMessages(json.data);
    }
  } catch (err) {
    console.error('Error loading chat:', err);
  }
}

function renderChatMessages(messages) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  messages.forEach(appendChatMessage);
  container.scrollTop = container.scrollHeight;
}

function appendChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  const isMine = msg.senderId?._id === currentUser._id || msg.senderId === currentUser._id;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isMine ? 'mine' : 'other'}`;
  bubble.innerHTML = `
    <div class="chat-bubble-sender">${isMine ? 'Vous' : (msg.senderId?.fullName || 'Interlocuteur')}</div>
    <div>${msg.content}</div>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input-text');
  const content = input.value.trim();
  if (!content || !activeChatBookingId) return;

  input.value = '';

  if (socket && socket.connected) {
    socket.emit('send_message', { bookingId: activeChatBookingId, content }, (res) => {
      if (res?.error) {
        showToast('Erreur envoi message : ' + res.error, true);
      }
    });
  } else {
    // REST fallback
    try {
      const res = await fetch(`/api/v1/conversations/${activeChatBookingId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ content })
      });
      const json = await res.json();
      if (json.success) {
        appendChatMessage(json.data);
      }
    } catch (err) {
      showToast('Erreur envoi message : ' + err.message, true);
    }
  }
}

// ==================== REVIEW MODAL ====================

let activeReviewBookingId = null;

function openReviewModal(bookingId) {
  activeReviewBookingId = bookingId;
  document.getElementById('review-modal').classList.add('open');
}

async function submitReview() {
  if (!activeReviewBookingId) return;

  const rating = parseInt(document.getElementById('review-rating').value, 10);
  const comment = document.getElementById('review-comment').value.trim();

  if (!comment) {
    showToast('Veuillez écrire un commentaire', true);
    return;
  }

  try {
    const res = await fetch('/api/v1/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ bookingId: activeReviewBookingId, rating, comment })
    });

    const json = await res.json();
    if (json.success) {
      closeModal('review-modal');
      showToast('Avis soumis avec succès ! Note moyenne du prestataire recalculée.');
      await loadProviders();
    } else {
      showToast('Erreur avis : ' + (json.error?.message || 'Échec'), true);
    }
  } catch (err) {
    showToast('Erreur réseau : ' + err.message, true);
  }
}

// ==================== HELPERS ====================

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('open');
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.style.background = isError ? 'var(--danger)' : 'var(--dark)';
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

function formatStatus(status) {
  const map = {
    PENDING_PAYMENT: 'En attente acompte',
    AWAITING_PROVIDER: 'En attente confirmation pro',
    CONFIRMED: 'Confirmée',
    IN_PROGRESS: 'Intervention en cours',
    COMPLETED: 'Terminée',
    REJECTED: 'Refusée',
    CANCELLED_BY_CLIENT: 'Annulée par client',
    CANCELLED_BY_PROVIDER: 'Annulée par pro',
    EXPIRED: 'Expirée'
  };
  return map[status] || status;
}
