// ================== FIREBASE ==================
var firebaseConfig = {
  apiKey: "AIzaSyDHFXOap1egB57a4Yh4y60tDbLMAzwyaz8",
  authDomain: "atta-chki.firebaseapp.com",
  projectId: "atta-chki",
  storageBucket: "atta-chki.firebasestorage.app",
  messagingSenderId: "906808155320",
  appId: "1:906808155320:web:5d6cc5e206b099ca27284d"
};

var db = null;
var firebaseReady = false;
var firebaseLoaded = false;
var isOnline = navigator.onLine;
var pendingChangesCount = 0;
var snapshotListeners = {};
var firstLoadDone = false;
var isSavingOrder = false;
var offlineOrdersQueue = [];
var offlineRoutesQueue = [];
var offlineAccountsQueue = [];
var pendingDeliverRouteId = null;
var pendingDeliverShopId = null;
var pendingWhatsappUrl = null;
var pendingWhatsappMessage = null;
var resetConfirmStage = 0;
var isHandlingBackButton = false;
var currentEditingOrder = null;
var currentEditOrderItems = [];
var currentEditItemIndex = -1;
var currentCancellingOrderId = null;
var accounts = [];
var currentAccountShopId = null;
var currentAmountItems = [];
var pendingOrderForAmount = null;
var currentFilterCategory = 'all';
var currentFarziDeliverOrderId = null;
var whatsappQueue = [];
var currentQueueReminderCount = 0;
var currentEditingWasooliId = null;
var currentDeletingWasooliId = null;

// Feature #4: Multi-tenant variables
var currentBusinessId = null;
var currentBusinessName = null;
var LEGACY_BUSINESS_ID = 'legacy_biz_001';
var SUPER_ADMIN_CODE_DEFAULT = 'ATTACHAKKI-ADMIN-2024';

// Feature #1 & #2
var currentOrderDetailShopId = null;
var currentOrderDetailReadOnly = false;
var currentSplitOrderId = null;
var currentSplitItems = [];

// Feature #5 + #7: Date Range + Collapse
var dashboardDateRange = { from: '', to: '' };
var ordersDateRange = { from: '', to: '' };
var deliveryDateRange = { from: '', to: '' };
var dashboardQuickRange = 'month';
var ordersQuickRange = 'month';
var deliveryQuickRange = 'month';
var dashboardDateFilterOpen = false; // Feature #7: default band

function initFirebase(callback) {
  if (firebaseLoaded) { if (callback) callback(); return; }
  firebaseLoaded = true;
  var script1 = document.createElement('script');
  script1.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
  script1.onload = function() {
    var script2 = document.createElement('script');
    script2.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js';
    script2.onload = function() {
      try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        db.enablePersistence({ synchronizeTabs: true }).then(function() {
          console.log('✅ Offline persistence enabled');
          firebaseReady = true;
          if (callback) callback();
        }).catch(function(err) {
          if (err.code === 'failed-precondition') console.log('⚠️ Multiple tabs open');
          else if (err.code === 'unimplemented') console.log('⚠️ Browser persistence support nahi karta');
          firebaseReady = true;
          if (callback) callback();
        });
      } catch (e) { console.log('Firebase error:', e); if (callback) callback(); }
    };
    document.head.appendChild(script2);
  };
  script1.onerror = function() { if (callback) callback(); };
  document.head.appendChild(script1);
}

var shopkeepers = [];
var orders = [];
var products = ['Aata', 'Besan', 'Chawal ka Atta'];
var settings = { bizName: 'Atta Chakki', mode: 'mobile' };
var users = [];
var routes = [];
var isLoggedIn = false;
var currentUser = null;
var currentDeliverOrderId = null;
var currentDeliverProduct = null;
var currentCombinedProduct = null;
var currentCombinedOrderIds = [];
var selectedShopIdForOrder = null;
var selectedProductForOrder = null;
var selectedEditIndex = -1;
var currentOrderItems = [];
var selectedRouteItems = {};
var currentPendingShopId = null;
var currentPendingProducts = [];
var menuLayout = null;
var dashboardLayout = null;
var menuEditMode = false;
var dashboardEditMode = false;

var DEFAULT_MENU = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-home', show: true },
  { key: 'neworder', label: 'Naya Order', icon: 'fa-plus-circle', show: true },
  { key: 'orders', label: 'Orders / Loading', icon: 'fa-truck', show: true },
  { key: 'routes', label: 'Delivery Routes', icon: 'fa-route', show: true },
  { key: 'shopkeepers', label: 'Shopkeepers', icon: 'fa-users', show: true },
  { key: 'accounts', label: 'Accounts', icon: 'fa-wallet', show: true },
  { key: 'pendingAmount', label: 'Amount Pending', icon: 'fa-hourglass-half', show: true },
  { key: 'whatsappQueue', label: 'WhatsApp Queue', icon: 'fa-paper-plane', show: true },
  { key: 'delivery', label: 'Delivery', icon: 'fa-check-circle', show: true },
  { key: 'history', label: 'History', icon: 'fa-clock', show: true },
  { key: 'users', label: 'Users', icon: 'fa-user-shield', show: true },
  { key: 'settings', label: 'Settings', icon: 'fa-gear', show: true }
];

var DEFAULT_DASHBOARD = [
  { key: 'bigButtons', label: 'Big Buttons', show: true, size: 100, view: 'grid' },
  { key: 'cards', label: '4 Cards', show: true, size: 100, view: 'grid' },
  { key: 'pendingShops', label: "Pending Shops", show: true, size: 100, view: 'list' },
  { key: 'load', label: 'Total Load', show: true, size: 100, view: 'list' },
  { key: 'routes', label: 'Delivery Routes', show: true, size: 100, view: 'list' }
];

function generateBusinessId() {
  return 'biz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// =====================================================
// Feature #5: Date Range Helpers
// =====================================================
function getTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function getDateOffset(days, months) {
  var d = new Date();
  if (days) d.setDate(d.getDate() - days);
  if (months) d.setMonth(d.getMonth() - months);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function getDefaultRange() {
  return { from: getDateOffset(0, 1), to: getTodayStr() };
}
function getQuickRange(type) {
  var today = getTodayStr();
  if (type === 'today') return { from: today, to: today };
  if (type === 'days') return { from: getDateOffset(7, 0), to: today };
  if (type === 'month') return { from: getDateOffset(0, 1), to: today };
  if (type === 'months') return { from: getDateOffset(0, 3), to: today };
  return getDefaultRange();
}
function initDateRanges() {
  var def = getDefaultRange();
  dashboardDateRange = { from: def.from, to: def.to };
  ordersDateRange = { from: def.from, to: def.to };
  deliveryDateRange = { from: def.from, to: def.to };
  var dFrom = document.getElementById('dashboardFromDate');
  var dTo = document.getElementById('dashboardToDate');
  if (dFrom) dFrom.value = def.from;
  if (dTo) dTo.value = def.to;
  var oFrom = document.getElementById('ordersFromDate');
  var oTo = document.getElementById('ordersToDate');
  if (oFrom) oFrom.value = def.from;
  if (oTo) oTo.value = def.to;
  var delFrom = document.getElementById('deliveryFromDate');
  var delTo = document.getElementById('deliveryToDate');
  if (delFrom) delFrom.value = def.from;
  if (delTo) delTo.value = def.to;
  updateDashboardRangeText();
}
function updateDashboardRangeText() {
  var el = document.getElementById('dashboardRangeText');
  if (!el) return;
  if (dashboardDateRange.from && dashboardDateRange.to) {
    el.textContent = formatDate(dashboardDateRange.from) + ' - ' + formatDate(dashboardDateRange.to);
  } else {
    el.textContent = '—';
  }
}
function onDashboardDateChange() {
  var f = document.getElementById('dashboardFromDate').value;
  var t = document.getElementById('dashboardToDate').value;
  if (f && t && f <= t) {
    dashboardDateRange.from = f;
    dashboardDateRange.to = t;
    dashboardQuickRange = null;
    document.querySelectorAll('#dashboardDateFilter .drf-quick-btn').forEach(function(b) { b.classList.remove('active'); });
    updateDashboardRangeText();
    renderDashboard();
  } else if (f && t) {
    showToast('From date To date se badi nahi ho sakti', 'warning', 2000);
    document.getElementById('dashboardFromDate').value = dashboardDateRange.from;
    document.getElementById('dashboardToDate').value = dashboardDateRange.to;
  }
}
function onOrdersDateChange() {
  var f = document.getElementById('ordersFromDate').value;
  var t = document.getElementById('ordersToDate').value;
  if (f && t && f <= t) {
    ordersDateRange.from = f;
    ordersDateRange.to = t;
    ordersQuickRange = null;
    document.querySelectorAll('#orders .drf-quick-btn').forEach(function(b) { b.classList.remove('active'); });
    renderOrdersPage();
  } else if (f && t) {
    showToast('From date To date se badi nahi ho sakti', 'warning', 2000);
    document.getElementById('ordersFromDate').value = ordersDateRange.from;
    document.getElementById('ordersToDate').value = ordersDateRange.to;
  }
}
function onDeliveryDateChange() {
  var f = document.getElementById('deliveryFromDate').value;
  var t = document.getElementById('deliveryToDate').value;
  if (f && t && f <= t) {
    deliveryDateRange.from = f;
    deliveryDateRange.to = t;
    deliveryQuickRange = null;
    document.querySelectorAll('#delivery .drf-quick-btn').forEach(function(b) { b.classList.remove('active'); });
    renderDelivery();
  } else if (f && t) {
    showToast('From date To date se badi nahi ho sakti', 'warning', 2000);
    document.getElementById('deliveryFromDate').value = deliveryDateRange.from;
    document.getElementById('deliveryToDate').value = deliveryDateRange.to;
  }
}
function setDashboardQuickRange(num, type) {
  var r = getQuickRange(type);
  dashboardDateRange = { from: r.from, to: r.to };
  document.getElementById('dashboardFromDate').value = r.from;
  document.getElementById('dashboardToDate').value = r.to;
  dashboardQuickRange = type;
  document.querySelectorAll('#dashboardDateFilter .drf-quick-btn').forEach(function(b) { b.classList.remove('active'); });
  if (event && event.target) event.target.classList.add('active');
  updateDashboardRangeText();
  renderDashboard();
}
function setOrdersQuickRange(num, type) {
  var r = getQuickRange(type);
  ordersDateRange = { from: r.from, to: r.to };
  document.getElementById('ordersFromDate').value = r.from;
  document.getElementById('ordersToDate').value = r.to;
  ordersQuickRange = type;
  document.querySelectorAll('#orders .drf-quick-btn').forEach(function(b) { b.classList.remove('active'); });
  if (event && event.target) event.target.classList.add('active');
  renderOrdersPage();
}
function setDeliveryQuickRange(num, type) {
  var r = getQuickRange(type);
  deliveryDateRange = { from: r.from, to: r.to };
  document.getElementById('deliveryFromDate').value = r.from;
  document.getElementById('deliveryToDate').value = r.to;
  deliveryQuickRange = type;
  document.querySelectorAll('#delivery .drf-quick-btn').forEach(function(b) { b.classList.remove('active'); });
  if (event && event.target) event.target.classList.add('active');
  renderDelivery();
}
function isOrderInRange(orderDate, range) {
  if (!range.from || !range.to) return true;
  return orderDate >= range.from && orderDate <= range.to;
}

// =====================================================
// Feature #7: Toggle Dashboard Date Filter
// =====================================================
function toggleDashboardDateFilter() {
  dashboardDateFilterOpen = !dashboardDateFilterOpen;
  var filterEl = document.getElementById('dashboardDateFilter');
  var editBtn = document.getElementById('editDateBtn');
  var doneBtn = document.getElementById('doneDateBtn');
  if (dashboardDateFilterOpen) {
    filterEl.style.display = 'block';
    editBtn.style.display = 'none';
    doneBtn.style.display = 'inline-block';
  } else {
    filterEl.style.display = 'none';
    editBtn.style.display = 'inline-block';
    doneBtn.style.display = 'none';
  }
}

function formatRs(amount) {
  var num = parseInt(amount) || 0;
  return 'Rs. ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function getUserInitials(user) {
  if (!user) return '??';
  var name = user.display || user.user || '';
  if (!name) return '??';
  var parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function getUserDisplayName(user) {
  if (!user) return 'Unknown';
  return user.display || user.user || 'Unknown';
}
function findUserByUsername(username) {
  if (!username) return null;
  for (var i = 0; i < users.length; i++) { if (users[i].user === username) return users[i]; }
  return null;
}
function getUserBadgeHtml(username, sizeClass) {
  if (!username) return '<span class="user-badge ' + (sizeClass || '') + ' old" title="Unknown user">??</span>';
  var user = findUserByUsername(username);
  var initials = user ? getUserInitials(user) : username.substring(0, 2).toUpperCase();
  var oldClass = user ? '' : ' old';
  var title = user ? getUserDisplayName(user) : username;
  return '<span class="user-badge ' + (sizeClass || '') + oldClass + '" title="' + title + '">' + initials + '</span>';
}
function formatDateTimeObj(d) {
  var day = String(d.getDate()).padStart(2, '0');
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var month = months[d.getMonth()];
  var year = d.getFullYear();
  var hours = d.getHours();
  var mins = String(d.getMinutes()).padStart(2, '0');
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12; if (hours === 0) hours = 12;
  var hoursStr = String(hours).padStart(2, '0');
  return day + ' ' + month + ' ' + year + ', ' + hoursStr + ':' + mins + ' ' + ampm;
}
function getCurrentDateTimeText() { return formatDateTimeObj(new Date()); }
function getOrderDateTimeText(order) {
  if (order && order.createdAt) {
    try { return formatDateTimeObj(new Date(order.createdAt)); } catch (e) {}
  }
  return getCurrentDateTimeText();
}
function getCurrentUserDisplayForWa() {
  if (!currentUser) return 'Unknown';
  return getUserDisplayName(currentUser);
}
function initBackButtonHandling() {
  history.pushState({ page: 'dashboard', depth: 0 }, '');
  window.addEventListener('popstate', function(event) {
    if (isHandlingBackButton) return;
    isHandlingBackButton = true;
    setTimeout(function() { handleBackButton(); isHandlingBackButton = false; }, 50);
  });
}
function handleBackButton() {
  var openModal = document.querySelector('.modal.active');
  if (openModal) {
    var modalId = openModal.id;
    if (modalId === 'pendingShopModal') closePendingShopModal();
    else if (modalId === 'modal') closeModal();
    else if (modalId === 'deliverModal') closeDeliverModal();
    else if (modalId === 'routeModal') closeRouteModal();
    else if (modalId === 'pinSetupModal') closePinSetup();
    else if (modalId === 'salesShopModal') closeSalesShopModal();
    else if (modalId === 'salesProductModal') closeSalesProductModal();
    else if (modalId === 'deliverConfirmModal') closeDeliverConfirmModal();
    else if (modalId === 'whatsappShareModal') closeWhatsappShareModal();
    else if (modalId === 'resetConfirmModal') closeResetConfirmModal();
    else if (modalId === 'editOrderModal') closeEditOrderModal();
    else if (modalId === 'editItemModal') closeEditItemModal();
    else if (modalId === 'cancelOrderModal') closeCancelOrderModal();
    else if (modalId === 'amountModal') closeAmountModal();
    else if (modalId === 'wasooliModal') closeWasooliModal();
    else if (modalId === 'farziDeliverModal') closeFarziDeliverModal();
    else if (modalId === 'whatsappQueueReminderModal') closeQueueReminderModal();
    else if (modalId === 'editWasooliModal') closeEditWasooliModal();
    else if (modalId === 'deleteWasooliModal') closeDeleteWasooliModal();
    else if (modalId === 'orderDetailModal') closeOrderDetailModal();
    else if (modalId === 'paymentSplitModal') closePaymentSplitModal();
    else openModal.classList.remove('active');
    history.pushState({ modalClosed: true }, '');
    return;
  }
  var activePage = document.querySelector('.page.active');
  var pageId = activePage ? activePage.id : 'dashboard';
  if (pageId === 'dashboard') { window.history.back(); return; }
  if (pageId === 'neworder') {
    var step3 = document.getElementById('quantityStep');
    var step2 = document.getElementById('productPickerStep');
    if (step3 && step3.style.display === 'block') { cancelQty(); history.pushState({ page: 'neworder', step: 2 }, ''); return; }
    if (step2 && step2.style.display === 'block') { changeShopkeeper(); history.pushState({ page: 'neworder', step: 1 }, ''); return; }
    showPage('dashboard'); history.pushState({ page: 'dashboard' }, ''); return;
  }
  showPage('dashboard'); history.pushState({ page: 'dashboard' }, '');
}
function hideAllScreens() {
  var ids = ['splashScreen','loginScreen','pinScreen','appWrapper'];
  for (var i = 0; i < ids.length; i++) { var el = document.getElementById(ids[i]); if (el) el.style.display = 'none'; }
}
function showSplashScreen() { hideAllScreens(); var el = document.getElementById('splashScreen'); if (el) el.style.display = 'flex'; }
function showLoginScreenOnly() { hideAllScreens(); var el = document.getElementById('loginScreen'); if (el) el.style.display = 'flex'; }
function showPinScreenOnly() {
  hideAllScreens();
  var pin = document.getElementById('pinScreen');
  if (pin) pin.style.display = 'flex';
  if (currentUser) { var nameEl = document.getElementById('pinUserName'); if (nameEl) nameEl.textContent = 'Hi, ' + (currentUser.display || currentUser.user); }
  var pinInput = document.getElementById('pinInput');
  if (pinInput) { pinInput.value = ''; setTimeout(function() { pinInput.focus(); }, 200); }
  var err = document.getElementById('pinError'); if (err) err.textContent = '';
}
function showAppScreenOnly() { hideAllScreens(); var el = document.getElementById('appWrapper'); if (el) el.style.display = 'block'; }
var toastTimeout = null;
function showToast(message, type, duration) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.className = 'toast'; toast.innerHTML = message;
  if (type) toast.classList.add(type);
  void toast.offsetWidth;
  toast.classList.add('show');
  toastTimeout = setTimeout(function() { toast.classList.remove('show'); }, duration || 3000);
}
function disableButton(btn, loadingText) {
  if (!btn) return;
  if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
  btn.disabled = true; btn.classList.add('loading');
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> ' + (loadingText || 'Saving...');
}
function enableButton(btn) {
  if (!btn) return;
  btn.disabled = false; btn.classList.remove('loading');
  if (btn.dataset.originalHtml) { btn.innerHTML = btn.dataset.originalHtml; delete btn.dataset.originalHtml; }
}
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  updateSyncStatusIndicator(); updateOfflineBanner(); updatePendingBanner(); updateSettingsSyncStatus();
}
window.addEventListener('online', function() {
  isOnline = true; updateOnlineStatus();
  showToast('🌐 Internet wapas aa gaya — sync ho raha hai...', 'success', 2500);
  syncOfflineAccountsQueue();
});
window.addEventListener('offline', function() { isOnline = false; updateOnlineStatus(); showToast('📴 Internet band — ab offline kaam karega', 'warning', 3000); });
function updateOfflineBanner() { var b = document.getElementById('offlineBanner'); if (!b) return; b.style.display = isOnline ? 'none' : 'block'; }
function updatePendingBanner() {
  var banner = document.getElementById('pendingBanner');
  if (!banner) return;
  if (pendingChangesCount > 0) {
    banner.style.display = 'block';
    var title = document.getElementById('pendingBannerTitle');
    var txt = document.getElementById('pendingBannerText');
    if (title) title.textContent = '⏳ ' + pendingChangesCount + ' change' + (pendingChangesCount > 1 ? 's' : '') + ' pending';
    if (txt) txt.textContent = isOnline ? 'Sync ho raha hai...' : 'Internet aane par automatic sync hoga';
  } else { banner.style.display = 'none'; }
}
function updateSyncStatusIndicator() {
  var indicator = document.getElementById('syncStatusIndicator');
  if (!indicator) return;
  indicator.className = 'sync-status';
  if (!isOnline) { indicator.classList.add('offline'); indicator.title = 'Offline'; }
  else if (pendingChangesCount > 0) { indicator.classList.add('pending'); indicator.title = pendingChangesCount + ' pending'; }
  else { indicator.classList.add('online'); indicator.title = 'Online'; }
}
function updateSettingsSyncStatus() {
  var st = document.getElementById('syncStatusText');
  var pt = document.getElementById('pendingChangesText');
  if (st) {
    if (!isOnline) { st.textContent = '🔴 Offline'; st.style.color = '#dc2626'; }
    else if (pendingChangesCount > 0) { st.textContent = '🟡 Syncing — ' + pendingChangesCount + ' pending'; st.style.color = '#f59e0b'; }
    else { st.textContent = '🟢 Online — Sab sync'; st.style.color = '#16a34a'; }
  }
  if (pt) {
    if (pendingChangesCount > 0) { pt.style.display = 'block'; pt.textContent = '⏳ ' + pendingChangesCount + ' changes pending'; }
    else { pt.style.display = 'none'; }
  }
  var qText = document.getElementById('settingsQueueText');
  if (qText) {
    var pendingQ = 0;
    for (var i = 0; i < whatsappQueue.length; i++) { if (whatsappQueue[i].status === 'pending') pendingQ++; }
    if (pendingQ > 0) qText.textContent = '⏳ ' + pendingQ + ' messages pending';
    else qText.textContent = '✅ Koi pending message nahi';
  }
}
function syncOfflineAccountsQueue() {
  if (!firebaseReady) return;
  if (offlineAccountsQueue.length === 0) return;
  var stillPending = [];
  var total = offlineAccountsQueue.length;
  for (var i = 0; i < offlineAccountsQueue.length; i++) {
    (function(entry) {
      var copy = JSON.parse(JSON.stringify(entry));
      delete copy.id;
      delete copy._offlinePending;
      if (!copy.businessId) copy.businessId = currentBusinessId;
      db.collection('accounts').add(copy).then(function() {
        console.log('✅ Offline account synced');
      }).catch(function(e) { console.log('❌ Offline account sync error:', e); stillPending.push(entry); });
    })(offlineAccountsQueue[i]);
  }
  setTimeout(function() {
    offlineAccountsQueue = stillPending;
    saveAccountsQueueToLocalStorage();
    if (total > 0) showToast('✅ ' + (total - stillPending.length) + ' offline account entries sync ho gaye', 'success', 3000);
  }, 3000);
}
function saveAccountsQueueToLocalStorage() {
  try { localStorage.setItem('offlineAccountsQueue', JSON.stringify(offlineAccountsQueue)); } catch (e) {}
}
function loadAccountsQueueFromLocalStorage() {
  try {
    var q = localStorage.getItem('offlineAccountsQueue');
    if (q) offlineAccountsQueue = JSON.parse(q) || [];
  } catch (e) { offlineAccountsQueue = []; }
}
function setupRealtimeListeners() {
  if (!firebaseReady) return;
  if (!currentBusinessId) { console.log('⚠️ No businessId — listeners skipped'); return; }

  if (!snapshotListeners.shopkeepers) {
    snapshotListeners.shopkeepers = db.collection('shopkeepers')
      .where('businessId', '==', currentBusinessId)
      .onSnapshot(function(snap) {
        shopkeepers = []; snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; shopkeepers.push(d); });
        refreshAllViews();
      }, function(err) { console.log('Shopkeepers listener:', err); });
  }
  if (!snapshotListeners.orders) {
    snapshotListeners.orders = db.collection('orders')
      .where('businessId', '==', currentBusinessId)
      .onSnapshot(function(snap) {
        orders = []; snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; d._offlinePending = false; orders.push(d); });
        offlineOrdersQueue = []; refreshAllViews();
      }, function(err) { console.log('Orders listener:', err); });
  }
  if (!snapshotListeners.products) {
    snapshotListeners.products = db.collection('settings').doc('products_' + currentBusinessId).onSnapshot(function(doc) {
      if (doc.exists) products = doc.data().list || products; refreshAllViews();
    }, function(err) { console.log('Products listener:', err); });
  }
  if (!snapshotListeners.business) {
    snapshotListeners.business = db.collection('settings').doc('business_' + currentBusinessId).onSnapshot(function(doc) {
      if (doc.exists) { var d = doc.data(); if (d.bizName) settings.bizName = d.bizName; } applySettings();
    }, function(err) { console.log('Business listener:', err); });
  }
  if (!snapshotListeners.users) {
    snapshotListeners.users = db.collection('users')
      .where('businessId', '==', currentBusinessId)
      .onSnapshot(function(snap) {
        users = []; snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; users.push(d); });
        if (currentUser) { for (var i = 0; i < users.length; i++) { if (users[i].id === currentUser.id) { currentUser = users[i]; localStorage.setItem('currentUser', JSON.stringify(currentUser)); break; } } }
        if (isAdmin()) renderUsers();
        refreshAllViews();
      }, function(err) { console.log('Users listener:', err); });
  }
  if (!snapshotListeners.routes) {
    snapshotListeners.routes = db.collection('routes')
      .where('businessId', '==', currentBusinessId)
      .onSnapshot(function(snap) {
        routes = []; var seenKeys = {};
        snap.forEach(function(doc) {
          var d = doc.data(); d.id = doc.id;
          if (!d.items || !Array.isArray(d.items)) {
            d.items = [];
            if (d.shopIds && Array.isArray(d.shopIds)) {
              var today = todayStr();
              for (var i = 0; i < d.shopIds.length; i++) {
                var sid = d.shopIds[i]; var added = {};
                for (var j = 0; j < orders.length; j++) {
                  var o = orders[j];
                  if (o.shopId != sid) continue; if (o.date !== today) continue;
                  if (o.status !== 'Pending' && o.status !== 'Partial') continue;
                  for (var k = 0; k < o.items.length; k++) { var p = o.items[k].product; if (!added[p]) { d.items.push({ shopId: sid, product: p }); added[p] = true; } }
                }
              }
              saveToFirebase('routes', d.id, d);
            }
            d.shopIds = undefined;
          }
          var routeKey = d.name + '|' + (d.createdAt || '');
          if (seenKeys[routeKey]) { console.log('⚠️ Duplicate route skip:', d.name); return; }
          seenKeys[routeKey] = true; routes.push(d);
        });
        refreshAllViews();
      }, function(err) { console.log('Routes listener:', err); });
  }
  if (!snapshotListeners.accounts) {
    snapshotListeners.accounts = db.collection('accounts')
      .where('businessId', '==', currentBusinessId)
      .onSnapshot(function(snap) {
        accounts = []; snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; accounts.push(d); });
        mergeOfflineAccounts();
        refreshAllViews();
      }, function(err) { console.log('Accounts listener:', err); });
  }
  if (!snapshotListeners.whatsappQueue) {
    snapshotListeners.whatsappQueue = db.collection('whatsappQueue')
      .where('businessId', '==', currentBusinessId)
      .onSnapshot(function(snap) {
        var firebaseQueue = [];
        snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; firebaseQueue.push(d); });
        var localOnly = [];
        for (var i = 0; i < whatsappQueue.length; i++) {
          var lq = whatsappQueue[i];
          var exists = false;
          for (var j = 0; j < firebaseQueue.length; j++) { if (firebaseQueue[j].id === lq.id) { exists = true; break; } }
          if (!exists && lq.status === 'pending' && lq.businessId === currentBusinessId) localOnly.push(lq);
        }
        whatsappQueue = firebaseQueue.concat(localOnly);
        saveQueueToLocalStorage();
        updateQueueBadge(); renderWhatsappQueue(); updateDashboardQueueBanner();
      }, function(err) { console.log('WhatsApp queue listener:', err); });
  }
  firstLoadDone = true;
}
function mergeOfflineAccounts() {
  if (offlineAccountsQueue.length === 0) return;
  for (var i = 0; i < offlineAccountsQueue.length; i++) {
    var off = offlineAccountsQueue[i];
    if (off.businessId && off.businessId !== currentBusinessId) continue;
    var exists = false;
    for (var j = 0; j < accounts.length; j++) {
      if (accounts[j].createdAt === off.createdAt && accounts[j].shopId == off.shopId && accounts[j].amount == off.amount) { exists = true; break; }
    }
    if (!exists) { off._offlinePending = true; accounts.push(off); }
  }
}
function refreshAllViews() {
  if (!currentUser) return;
  mergeOfflineOrders(); mergeOfflineRoutes(); mergeOfflineAccounts();
  renderDashboard(); renderShopkeepers(); renderRoutes(); renderHistory();
  renderRouteShopPicker(); applyDashboardLayout(); renderHiddenMenuList(); populateSalesFilters();
  renderAccounts(); renderPendingAmounts();
  var ordPage = document.getElementById('orders'); if (ordPage && ordPage.classList.contains('active')) renderOrdersPage();
  var delPage = document.getElementById('delivery'); if (delPage && delPage.classList.contains('active')) renderDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  var accPage = document.getElementById('accountDetail'); if (accPage && accPage.classList.contains('active')) renderAccountDetailEntries();
}
function mergeOfflineOrders() {
  if (offlineOrdersQueue.length === 0) return;
  var stillPending = [];
  for (var i = 0; i < offlineOrdersQueue.length; i++) {
    var off = offlineOrdersQueue[i];
    if (off.businessId && off.businessId !== currentBusinessId) { stillPending.push(off); continue; }
    var foundOnFirebase = false;
    for (var j = 0; j < orders.length; j++) { if (orders[j].createdAt === off.createdAt && orders[j].shopId == off.shopId) { foundOnFirebase = true; break; } }
    if (!foundOnFirebase) { off._offlinePending = true; stillPending.push(off); }
  }
  offlineOrdersQueue = stillPending;
  for (var i = 0; i < offlineOrdersQueue.length; i++) {
    var off = offlineOrdersQueue[i];
    if (off.businessId && off.businessId !== currentBusinessId) continue;
    var exists = false;
    for (var j = 0; j < orders.length; j++) { if (orders[j].id === off.id) { exists = true; break; } }
    if (!exists) orders.push(off);
  }
}
function mergeOfflineRoutes() {
  if (offlineRoutesQueue.length === 0) return;
  var stillPending = [];
  for (var i = 0; i < offlineRoutesQueue.length; i++) {
    var off = offlineRoutesQueue[i];
    if (off.businessId && off.businessId !== currentBusinessId) { stillPending.push(off); continue; }
    var foundOnFirebase = false;
    for (var j = 0; j < routes.length; j++) { if (routes[j].createdAt === off.createdAt && routes[j].name === off.name) { foundOnFirebase = true; break; } }
    if (!foundOnFirebase) stillPending.push(off);
  }
  offlineRoutesQueue = stillPending;
  for (var i = 0; i < offlineRoutesQueue.length; i++) {
    var off = offlineRoutesQueue[i];
    if (off.businessId && off.businessId !== currentBusinessId) continue;
    var exists = false;
    for (var j = 0; j < routes.length; j++) { if (routes[j].id === off.id) { exists = true; break; } }
    if (!exists) routes.push(off);
  }
}
function loadAllData(callback) { setupRealtimeListeners(); setTimeout(function() { if (callback) callback(); }, 800); }
function saveToFirebase(collection, id, data) {
  if (!firebaseReady) return Promise.reject('Firebase not ready');
  if (currentBusinessId && data && !data.businessId) {
    data.businessId = currentBusinessId;
  }
  pendingChangesCount++; updateSyncStatusIndicator(); updatePendingBanner(); updateSettingsSyncStatus();
  return db.collection(collection).doc(String(id)).set(data).then(function() {
    pendingChangesCount = Math.max(0, pendingChangesCount - 1);
    updateSyncStatusIndicator(); updatePendingBanner(); updateSettingsSyncStatus();
  }).catch(function(e) {
    pendingChangesCount = Math.max(0, pendingChangesCount - 1);
    updateSyncStatusIndicator(); updatePendingBanner(); updateSettingsSyncStatus();
    throw e;
  });
}
function deleteFromFirebase(collection, id) {
  if (!firebaseReady) return;
  pendingChangesCount++; updateSyncStatusIndicator(); updatePendingBanner(); updateSettingsSyncStatus();
  db.collection(collection).doc(String(id)).delete().then(function() {
    pendingChangesCount = Math.max(0, pendingChangesCount - 1);
    updateSyncStatusIndicator(); updatePendingBanner(); updateSettingsSyncStatus();
  }).catch(function(e) {
    pendingChangesCount = Math.max(0, pendingChangesCount - 1);
    updateSyncStatusIndicator(); updatePendingBanner(); updateSettingsSyncStatus();
  });
}
function saveSettingsFirebase() {
  if (!firebaseReady || !currentBusinessId) return;
  saveToFirebase('settings', 'products_' + currentBusinessId, { list: products, businessId: currentBusinessId });
  saveToFirebase('settings', 'business_' + currentBusinessId, { bizName: settings.bizName, businessId: currentBusinessId });
}
function confirmResetAllData() {
  if (!isAdmin()) { showToast('Sirf Admin reset kar sakta hai', 'error'); return; }
  resetConfirmStage = 0;
  var textEl = document.getElementById('resetConfirmText');
  var bodyEl = document.getElementById('resetConfirmBody');
  var btnEl = document.getElementById('resetConfirmBtn');
  if (textEl) textEl.textContent = 'Pakka reset karna hai? Aap ke business ka saara data delete ho jayega.';
  if (bodyEl) bodyEl.innerHTML = '<p style="color:#64748b;font-size:14px;margin:10px 0;">Ye delete hoga (sirf aap ke business ka): <b>Shopkeepers, Products, Orders, Routes, Accounts, WhatsApp Queue</b><br>Ye safe rahega: <b>Users, PIN, Business Name</b><br><br><b style="color:#16a34a;">Doosre businesses ka data safe rahega ✅</b></p>';
  if (btnEl) btnEl.innerHTML = '<i class="fa fa-arrow-right"></i> Haan, Aage Badhein';
  document.getElementById('resetConfirmModal').classList.add('active');
}
function proceedResetConfirm() {
  if (resetConfirmStage === 0) {
    resetConfirmStage = 1;
    var textEl = document.getElementById('resetConfirmText');
    var bodyEl = document.getElementById('resetConfirmBody');
    var btnEl = document.getElementById('resetConfirmBtn');
    if (textEl) textEl.textContent = '⚠️ Aakhri baar pooch rahe hain — AAP KE BUSINESS ka SAB KUCH delete ho jayega!';
    if (bodyEl) bodyEl.innerHTML = '<p style="color:#dc2626;font-size:14px;margin:10px 0;font-weight:600;">Ye action undo nahi ho sakta.</p>';
    if (btnEl) btnEl.innerHTML = '<i class="fa fa-rotate-left"></i> Haan, Confirm Reset';
    return;
  }
  doResetAllData();
}
function closeResetConfirmModal() {
  document.getElementById('resetConfirmModal').classList.remove('active');
  resetConfirmStage = 0;
}
function doResetAllData() {
  closeResetConfirmModal();
  if (!firebaseReady) { showToast('Firebase load nahi hua', 'error'); return; }
  if (!currentBusinessId) { showToast('Business ID nahi mili', 'error'); return; }
  showToast('⏳ Reset ho raha hai...', 'info', 5000);
  var bizId = currentBusinessId;

  function deleteCollectionByName(colName) {
    return db.collection(colName).where('businessId', '==', bizId).get().then(function(snap) {
      if (snap.empty) return;
      var batch = db.batch();
      snap.forEach(function(doc) { batch.delete(doc.ref); });
      return batch.commit();
    });
  }

  deleteCollectionByName('shopkeepers')
    .then(function() { return deleteCollectionByName('orders'); })
    .then(function() { return deleteCollectionByName('routes'); })
    .then(function() { return deleteCollectionByName('accounts'); })
    .then(function() { return deleteCollectionByName('whatsappQueue'); })
    .then(function() { return db.collection('settings').doc('products_' + bizId).set({ list: [], businessId: bizId }); })
    .then(function() {
      shopkeepers = []; orders = []; routes = []; products = []; accounts = []; whatsappQueue = [];
      offlineOrdersQueue = []; offlineRoutesQueue = []; offlineAccountsQueue = [];
      localStorage.removeItem('whatsappQueueLocal'); localStorage.removeItem('offlineAccountsQueue');
      renderDashboard(); renderShopkeepers(); renderRoutes(); renderHistory(); renderSettings(); renderRouteShopPicker(); populateSalesFilters(); renderAccounts(); renderPendingAmounts(); renderWhatsappQueue();
      if (isAdmin()) renderUsers();
      showToast('✅ Aap ke business ka saara data reset ho gaya!', 'success', 4000);
    }).catch(function(e) { console.log('Reset error:', e); showToast('❌ Reset mein masla: ' + (e.message || 'Unknown'), 'error', 5000); });
}

function loadLayouts() {
  if (currentUser && currentUser.menuLayout && Array.isArray(currentUser.menuLayout) && currentUser.menuLayout.length > 0) {
    menuLayout = currentUser.menuLayout.slice();
    for (var i = 0; i < DEFAULT_MENU.length; i++) {
      var exists = false;
      for (var j = 0; j < menuLayout.length; j++) { if (menuLayout[j].key === DEFAULT_MENU[i].key) { exists = true; break; } }
      if (!exists) menuLayout.push(JSON.parse(JSON.stringify(DEFAULT_MENU[i])));
    }
  } else { menuLayout = JSON.parse(JSON.stringify(DEFAULT_MENU)); }
  if (currentUser && currentUser.dashboardLayout && Array.isArray(currentUser.dashboardLayout) && currentUser.dashboardLayout.length > 0) {
    dashboardLayout = currentUser.dashboardLayout.slice();
    for (var i = 0; i < DEFAULT_DASHBOARD.length; i++) {
      var exists = false;
      for (var j = 0; j < dashboardLayout.length; j++) { if (dashboardLayout[j].key === DEFAULT_DASHBOARD[i].key) { exists = true; break; } }
      if (!exists) dashboardLayout.push(JSON.parse(JSON.stringify(DEFAULT_DASHBOARD[i])));
    }
    for (var i = 0; i < dashboardLayout.length; i++) { if (!dashboardLayout[i].view) dashboardLayout[i].view = 'grid'; }
  } else { dashboardLayout = JSON.parse(JSON.stringify(DEFAULT_DASHBOARD)); }
}
function saveMenuLayout() {
  if (!currentUser) return;
  currentUser.menuLayout = menuLayout.slice();
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady && currentUser.id) db.collection('users').doc(String(currentUser.id)).update({ menuLayout: menuLayout }).catch(function(e) { console.log(e); });
}
function saveDashboardLayout() {
  if (!currentUser) return;
  currentUser.dashboardLayout = dashboardLayout.slice();
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady && currentUser.id) db.collection('users').doc(String(currentUser.id)).update({ dashboardLayout: dashboardLayout }).catch(function(e) { console.log(e); });
}
function toggleMenuEdit() {
  menuEditMode = !menuEditMode;
  var panel = document.getElementById('menuEditPanel');
  var nav = document.getElementById('sidebarNav');
  var btn = document.getElementById('editMenuBtn');
  if (menuEditMode) {
    panel.style.display = 'block'; nav.style.display = 'none';
    btn.innerHTML = '<i class="fa fa-eye"></i> Preview Menu'; renderMenuEditList();
  } else {
    panel.style.display = 'none'; nav.style.display = 'flex';
    btn.innerHTML = '<i class="fa fa-pen"></i> Edit Menu'; renderSidebarNav();
  }
}
function renderMenuEditList() {
  var list = document.getElementById('menuEditList');
  if (!list) return;
  var html = '';
  for (var i = 0; i < menuLayout.length; i++) {
    var item = menuLayout[i];
    var canUp = i > 0, canDown = i < menuLayout.length - 1;
    html += '<div class="menu-edit-item ' + (item.show ? '' : 'hidden-item') + '">' +
      '<input type="checkbox" ' + (item.show ? 'checked' : '') + ' onchange="toggleMenuShow(' + i + ', this.checked)" />' +
      '<span class="me-name"><i class="fa ' + item.icon + '"></i> ' + item.label + '</span>' +
      '<span class="me-arrows">' +
        '<button onclick="moveMenuItem(' + i + ', -1)" ' + (canUp ? '' : 'disabled') + '><i class="fa fa-arrow-up"></i></button>' +
        '<button onclick="moveMenuItem(' + i + ', 1)" ' + (canDown ? '' : 'disabled') + '><i class="fa fa-arrow-down"></i></button>' +
      '</span></div>';
  }
  list.innerHTML = html;
}
function toggleMenuShow(idx, checked) {
  if (idx < 0 || idx >= menuLayout.length) return;
  menuLayout[idx].show = checked;
  saveMenuLayout(); renderMenuEditList(); renderHiddenMenuList();
}
function moveMenuItem(idx, dir) {
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= menuLayout.length) return;
  var temp = menuLayout[idx]; menuLayout[idx] = menuLayout[newIdx]; menuLayout[newIdx] = temp;
  saveMenuLayout(); renderMenuEditList();
}
function resetMenuLayout() {
  if (!confirm('Menu ko default pe reset karein?')) return;
  menuLayout = JSON.parse(JSON.stringify(DEFAULT_MENU));
  saveMenuLayout(); renderMenuEditList(); renderHiddenMenuList(); renderSidebarNav();
}
function toggleDashboardEdit() {
  dashboardEditMode = !dashboardEditMode;
  var panel = document.getElementById('dashEditPanel');
  var editBtn = document.getElementById('editDashBtn');
  var doneBtn = document.getElementById('doneDashBtn');
  var resetBtn = document.getElementById('resetDashBtn');
  if (dashboardEditMode) {
    panel.style.display = 'block'; editBtn.style.display = 'none';
    doneBtn.style.display = 'inline-block'; resetBtn.style.display = 'inline-block';
    renderDashEditList(); applyDashboardLayout();
  } else {
    panel.style.display = 'none'; editBtn.style.display = 'inline-block';
    doneBtn.style.display = 'none'; resetBtn.style.display = 'none';
    applyDashboardLayout();
  }
}
function renderDashEditList() {
  var list = document.getElementById('dashEditList');
  if (!list) return;
  var html = '';
  for (var i = 0; i < dashboardLayout.length; i++) {
    var item = dashboardLayout[i];
    var currentView = item.view || 'grid';
    var gridActive = currentView === 'grid' ? ' active' : '';
    var listActive = currentView === 'list' ? ' active' : '';
    html += '<div class="dash-edit-row">' +
      '<input type="checkbox" ' + (item.show ? 'checked' : '') + ' onchange="toggleDashShow(' + i + ', this.checked)" />' +
      '<span class="de-name">' + item.label + '</span>' +
      '<span class="de-slider-wrap">' +
        '<input type="range" min="20" max="100" value="' + item.size + '" oninput="updateDashSize(' + i + ', this.value)" />' +
        '<span class="de-value" id="deVal' + i + '">' + item.size + '%</span>' +
      '</span>' +
      '<span class="de-view-toggle">' +
        '<button class="' + gridActive + '" onclick="setDashView(' + i + ', \'grid\')"><i class="fa fa-th-large"></i> Grid</button>' +
        '<button class="' + listActive + '" onclick="setDashView(' + i + ', \'list\')"><i class="fa fa-list"></i> List</button>' +
      '</span></div>';
  }
  list.innerHTML = html;
}
function toggleDashShow(idx, checked) {
  if (idx < 0 || idx >= dashboardLayout.length) return;
  dashboardLayout[idx].show = checked;
  saveDashboardLayout(); applyDashboardLayout(); renderDashEditList();
}
function updateDashSize(idx, val) {
  if (idx < 0 || idx >= dashboardLayout.length) return;
  dashboardLayout[idx].size = parseInt(val) || 100;
  var lbl = document.getElementById('deVal' + idx); if (lbl) lbl.textContent = dashboardLayout[idx].size + '%';
  saveDashboardLayout(); applyDashboardLayout();
}
function setDashView(idx, view) {
  if (idx < 0 || idx >= dashboardLayout.length) return;
  dashboardLayout[idx].view = view;
  saveDashboardLayout(); applyDashboardLayout(); renderDashEditList();
}
function resetDashboardLayout() {
  if (!confirm('Dashboard ko default pe reset karein?')) return;
  dashboardLayout = JSON.parse(JSON.stringify(DEFAULT_DASHBOARD));
  saveDashboardLayout(); applyDashboardLayout(); renderDashEditList();
}
function applyDashboardLayout() {
  if (!dashboardLayout) return;
  var sectionIds = { bigButtons: 'sec-bigButtons', cards: 'sec-cards', pendingShops: 'sec-pendingShops', load: 'sec-load', routes: 'sec-routes' };
  for (var i = 0; i < dashboardLayout.length; i++) {
    var item = dashboardLayout[i];
    var el = document.getElementById(sectionIds[item.key]);
    if (!el) continue;
    if (item.show) { el.classList.remove('dash-hidden'); el.style.display = ''; }
    else { el.classList.add('dash-hidden'); el.style.display = 'none'; }
    var size = parseInt(item.size) || 100;
    if (size >= 100) { el.style.width = ''; el.style.maxWidth = ''; el.style.marginLeft = ''; el.style.marginRight = ''; }
    else { el.style.width = size + '%'; el.style.maxWidth = size + '%'; el.style.marginLeft = 'auto'; el.style.marginRight = 'auto'; }
    var view = item.view || 'grid';
    if (item.key === 'bigButtons') { var bb = document.getElementById('bigButtonsWrap'); if (bb) { if (view === 'list') bb.classList.add('list-view'); else bb.classList.remove('list-view'); } }
    if (item.key === 'cards') { var cw = document.getElementById('cardsWrap'); if (cw) { if (view === 'list') cw.classList.add('list-view'); else cw.classList.remove('list-view'); } }
  }
}
function renderHiddenMenuList() {
  var box = document.getElementById('hiddenMenuBox');
  var list = document.getElementById('hiddenMenuList');
  if (!box || !list) return;
  if (!menuLayout) { box.style.display = 'none'; return; }
  var hidden = [];
  for (var i = 0; i < menuLayout.length; i++) { if (!menuLayout[i].show) hidden.push(menuLayout[i]); }
  if (hidden.length === 0) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  var html = '';
  for (var i = 0; i < hidden.length; i++) {
    var h = hidden[i];
    html += '<a class="hidden-menu-link" onclick="showPage(\'' + h.key + '\', null)"><i class="fa ' + h.icon + '"></i> ' + h.label + '<i class="fa fa-arrow-right" style="margin-left:auto;"></i></a>';
  }
  list.innerHTML = html;
}
function formatWaNumber(mobile) {
  if (!mobile) return '';
  var digits = String(mobile).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.indexOf('0') === 0) return '92' + digits.substring(1);
  if (digits.indexOf('92') === 0) return digits;
  if (digits.length === 10 && digits.indexOf('3') === 0) return '92' + digits;
  return digits;
}
function formatOrderItemsText(items) {
  var lines = [];
  for (var i = 0; i < items.length; i++) { 
    var it = items[i]; 
    var qty = qtyText(it.maund, it.kg); 
    var amtText = (parseInt(it.amount) || 0) > 0 ? ' — ' + formatRs(it.amount) : ' — Rs. 0';
    lines.push('• ' + it.product + ' — ' + qty + amtText); 
  }
  return lines.join('\n');
}
function saveToWhatsappQueue(data) {
  data.id = 'queue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  data.createdAt = data.createdAt || new Date().toISOString();
  data.status = 'pending';
  data.createdBy = currentUser ? currentUser.user : 'unknown';
  if (currentBusinessId) data.businessId = currentBusinessId;
  whatsappQueue.push(data);
  saveQueueToLocalStorage();
  updateQueueBadge();
  updateDashboardQueueBanner();
  if (firebaseReady) {
    db.collection('whatsappQueue').doc(data.id).set(data).catch(function(e) { console.log('Queue save error:', e); });
  }
}
function saveQueueToLocalStorage() {
  try { localStorage.setItem('whatsappQueueLocal', JSON.stringify(whatsappQueue)); } catch (e) {}
}
function loadQueueFromLocalStorage() {
  try {
    var q = localStorage.getItem('whatsappQueueLocal');
    if (q) { whatsappQueue = JSON.parse(q); updateQueueBadge(); updateDashboardQueueBanner(); }
  } catch (e) {}
}
function getPendingQueueCount() {
  var count = 0;
  for (var i = 0; i < whatsappQueue.length; i++) { 
    if (whatsappQueue[i].status === 'pending') {
      if (!currentBusinessId || !whatsappQueue[i].businessId || whatsappQueue[i].businessId === currentBusinessId) count++;
    }
  }
  return count;
}
function updateQueueBadge() {
  var activeCount = getPendingQueueCount();
  var nav = document.getElementById('sidebarNav');
  if (nav && currentUser) renderSidebarNav();
  var dq = document.getElementById('dashboardQueueBanner');
  if (dq) {
    if (activeCount > 0) {
      dq.style.display = 'flex';
      var t = document.getElementById('dashboardQueueTitle');
      if (t) t.textContent = activeCount + ' WhatsApp message' + (activeCount > 1 ? 's' : '') + ' pending';
    } else { dq.style.display = 'none'; }
  }
}
function updateDashboardQueueBanner() { updateQueueBadge(); }
function checkWhatsappQueueReminder() {
  cleanupOldQueue();
  var activeCount = getPendingQueueCount();
  if (activeCount > 0) { currentQueueReminderCount = activeCount; showQueueReminderModal(activeCount); }
}
function showQueueReminderModal(count) {
  var modal = document.getElementById('whatsappQueueReminderModal');
  var txt = document.getElementById('queueReminderText');
  if (txt) txt.textContent = 'Aap ke ' + count + ' messages WhatsApp par nahi bheje gaye';
  if (modal) modal.classList.add('active');
}
function closeQueueReminderModal() {
  var modal = document.getElementById('whatsappQueueReminderModal');
  if (modal) modal.classList.remove('active');
}
function goToQueueFromReminder() {
  closeQueueReminderModal();
  showPage('whatsappQueue');
}
function shareFromQueue(id) {
  var q = null;
  for (var i = 0; i < whatsappQueue.length; i++) { if (whatsappQueue[i].id === id) { q = whatsappQueue[i]; break; } }
  if (!q) return;
  if (!isOnline) { showToast('📴 Internet nahi hai', 'warning', 3000); return; }
  q.status = 'shared';
  q.sharedAt = new Date().toISOString();
  if (firebaseReady) {
    db.collection('whatsappQueue').doc(q.id).update({ status: 'shared', sharedAt: q.sharedAt }).catch(function(e) { console.log(e); });
  }
  saveQueueToLocalStorage();
  renderWhatsappQueue();
  updateQueueBadge();
  var url = 'https://wa.me/' + q.mobile + '?text=' + encodeURIComponent(q.message);
  window.open(url, '_blank');
  showToast('✅ Message WhatsApp par khul gaya', 'success');
}
function deleteFromQueue(id) {
  if (!confirm('Ye message queue se delete karein?')) return;
  var newQueue = [];
  for (var i = 0; i < whatsappQueue.length; i++) {
    if (whatsappQueue[i].id === id) { if (firebaseReady) db.collection('whatsappQueue').doc(id).delete().catch(function(e) {}); }
    else newQueue.push(whatsappQueue[i]);
  }
  whatsappQueue = newQueue;
  saveQueueToLocalStorage(); renderWhatsappQueue(); updateQueueBadge();
  showToast('Message delete ho gaya', 'info');
}
function cleanupOldQueue() {
  var now = new Date(); var newQueue = [];
  for (var i = 0; i < whatsappQueue.length; i++) {
    var q = whatsappQueue[i];
    if (q.deleteAt && new Date(q.deleteAt) < now) { if (firebaseReady) db.collection('whatsappQueue').doc(q.id).delete().catch(function(e) {}); }
    else newQueue.push(q);
  }
  whatsappQueue = newQueue;
  saveQueueToLocalStorage(); updateQueueBadge();
}
function renderWhatsappQueue() {
  var list = document.getElementById('queueList');
  if (!list) return;
  var badge = document.getElementById('queueCountBadge');
  var active = [];
  for (var i = 0; i < whatsappQueue.length; i++) { 
    if (whatsappQueue[i].status === 'pending') {
      if (!currentBusinessId || !whatsappQueue[i].businessId || whatsappQueue[i].businessId === currentBusinessId) active.push(whatsappQueue[i]);
    }
  }
  if (badge) badge.textContent = active.length;
  if (active.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Koi pending message nahi</div>'; return; }
  active.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  var html = ''; var now = new Date();
  for (var i = 0; i < active.length; i++) {
    var q = active[i];
    var typeIcon = '📦'; var typeClass = 'type-order';
    if (q.type === 'delivery') { typeIcon = '✅'; typeClass = 'type-delivery'; }
    else if (q.type === 'edit') { typeIcon = '✏️'; typeClass = 'type-edit'; }
    else if (q.type === 'cancel') { typeIcon = '❌'; typeClass = 'type-cancel'; }
    var created = new Date(q.createdAt);
    var daysOld = Math.floor((now - created) / (24 * 60 * 60 * 1000));
    var warning = '';
    if (daysOld >= 5) warning = '<span class="queue-expired-warning">⚠️ ' + daysOld + ' din purana</span>';
    html += '<div class="queue-item-card ' + typeClass + '">' +
      '<div class="qi-head"><span class="qi-type-icon">' + typeIcon + '</span><span class="qi-shop">' + (q.shopName || 'Unknown') + '</span></div>' +
      '<div class="qi-meta">📱 ' + (q.mobile || '') + ' • ' + formatDateTimeObj(created) + '</div>' + warning +
      '<div class="qi-actions">' +
        '<button class="btn small success" onclick="shareFromQueue(\'' + q.id + '\')"><i class="fa fa-share"></i> Share</button>' +
        '<button class="btn small danger" onclick="deleteFromQueue(\'' + q.id + '\')"><i class="fa fa-trash"></i> Delete</button>' +
      '</div></div>';
  }
  list.innerHTML = html;
}
function getShopTotalKhata(shopId) {
  var total = 0;
  for (var i = 0; i < accounts.length; i++) {
    var a = accounts[i];
    if (a.shopId != shopId) continue;
    if (a.type === 'order') total += parseInt(a.amount) || 0;
    else if (a.type === 'payment') total -= parseInt(a.amount) || 0;
  }
  return total;
}
function getShopAccountEntries(shopId) {
  var list = [];
  for (var i = 0; i < accounts.length; i++) { if (accounts[i].shopId == shopId) list.push(accounts[i]); }
  list.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return list;
}
function getLastTransactionDate(shopId) {
  var latest = null;
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i].shopId != shopId) continue;
    var d = new Date(accounts[i].createdAt);
    if (!latest || d > latest) latest = d;
  }
  return latest;
}
function getAccountsTotal() {
  var total = 0;
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    if ((s.category || 'regular') === 'farzi') continue;
    total += getShopTotalKhata(s.id);
  }
  return total;
}
function renderAccounts() {
  var list = document.getElementById('accountsList');
  var totalEl = document.getElementById('accountsTotalAmount');
  if (!list) return;
  if (totalEl) totalEl.textContent = formatRs(getAccountsTotal());
  var searchEl = document.getElementById('accountsSearchInput');
  var search = searchEl ? searchEl.value.toLowerCase().trim() : '';
  var filtered = [];
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    if ((s.category || 'regular') === 'farzi') continue;
    if (search) {
      var name = (s.name || '').toLowerCase();
      var mobile = (s.mobile || '').toLowerCase();
      if (name.indexOf(search) === -1 && mobile.indexOf(search) === -1) continue;
    }
    filtered.push(s);
  }
  if (filtered.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-wallet"></i>Koi shopkeeper nahi mila</div>'; return; }
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var s = filtered[i];
    var total = getShopTotalKhata(s.id);
    var lastDate = getLastTransactionDate(s.id);
    var lastText = lastDate ? formatDateTimeObj(lastDate) : 'Koi transaction nahi';
    var amountClass = total > 0 ? 'negative' : (total < 0 ? 'positive' : '');
    var amountText = total === 0 ? 'Rs. 0' : (total > 0 ? '- ' + formatRs(total).replace('Rs. ', 'Rs ') : '+ ' + formatRs(-total).replace('Rs. ', 'Rs '));
    html += '<div class="account-shop-card" onclick="openAccountDetail(\'' + s.id + '\')">' +
      '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">' +
        '<span class="user-badge">' + getShopInitials(s.name) + '</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="as-name">' + s.name + '</div>' +
          '<div class="as-date">last transacted: ' + lastText + '</div>' +
        '</div></div>' +
      '<div class="as-amount ' + amountClass + '">' + amountText + '</div>' +
    '</div>';
  }
  list.innerHTML = html;
}
function getShopInitials(name) {
  if (!name) return '??';
  var parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function openAccountDetail(shopId) {
  var shop = getShopById(shopId);
  if (!shop) return;
  currentAccountShopId = shopId;
  var nameEl = document.getElementById('accountDetailName');
  var mobileEl = document.getElementById('accountDetailMobile');
  if (nameEl) nameEl.textContent = shop.name;
  if (mobileEl) mobileEl.innerHTML = '<i class="fa fa-phone"></i> ' + shop.mobile;
  var totalEl = document.getElementById('accountDetailTotal');
  if (totalEl) totalEl.textContent = formatRs(getShopTotalKhata(shopId));
  renderAccountDetailEntries();
  showPage('accountDetail');
}
function renderAccountDetailEntries() {
  var box = document.getElementById('accountDetailEntries');
  if (!box) return;
  var entries = getShopAccountEntries(currentAccountShopId);
  if (entries.length === 0) { box.innerHTML = '<div class="empty"><i class="fa fa-list"></i>Koi entry nahi</div>'; return; }
  var html = '';
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var icon = e.type === 'order' ? '📦' : '💵';
    var label = e.type === 'order'
      ? 'Order: ' + (e.productName || '') + ' (' + qtyText(e.maund, e.kg) + ')'
      : 'Wasooli';
    var sign = e.type === 'order' ? '+' : '-';
    var cls = e.type === 'order' ? 'plus' : 'minus';
    var offlineTag = e._offlinePending ? ' <span style="background:#f59e0b;color:#fff;font-size:9px;padding:2px 6px;border-radius:8px;font-weight:700;">⏳</span>' : '';
    var actionsHtml = '';
    if (e.type === 'payment') {
      actionsHtml = '<div style="display:flex;gap:6px;margin-top:6px;">' +
        '<button class="btn small" onclick="openEditWasooliModal(\'' + e.id + '\')" style="padding:5px 10px;font-size:11px;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;"><i class="fa fa-edit"></i> Edit</button>' +
        '<button class="btn small danger" onclick="openDeleteWasooliModal(\'' + e.id + '\')" style="padding:5px 10px;font-size:11px;"><i class="fa fa-trash"></i> Delete</button>' +
      '</div>';
    }
    html += '<div class="khata-entry ' + e.type + '">' +
      '<div class="ke-date">' + formatDateTimeObj(new Date(e.createdAt)) + offlineTag + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">' +
        '<span style="font-weight:600;color:#1e293b;">' + icon + ' ' + label + '</span>' +
        '<span class="ke-amount ' + cls + '" style="font-weight:800;font-size:16px;">' + sign + ' ' + formatRs(e.amount) + '</span>' +
      '</div>' +
      (e.note ? '<div style="font-size:12px;color:#64748b;margin-top:4px;">📝 ' + e.note + '</div>' : '') +
      actionsHtml + '</div>';
  }
  box.innerHTML = html;
}
function openWasooliModal() {
  if (!currentAccountShopId) return;
  var shop = getShopById(currentAccountShopId);
  if (!shop) return;
  var nameEl = document.getElementById('wasooliShopName');
  if (nameEl) nameEl.textContent = shop.name + ' — ' + shop.mobile;
  var amtEl = document.getElementById('wasooliAmount'); var noteEl = document.getElementById('wasooliNote');
  if (amtEl) amtEl.value = ''; if (noteEl) noteEl.value = '';
  document.getElementById('wasooliModal').classList.add('active');
  setTimeout(function() { if (amtEl) amtEl.focus(); }, 200);
}
function closeWasooliModal() { document.getElementById('wasooliModal').classList.remove('active'); }
function saveWasooli(btn) {
  var amount = parseInt(document.getElementById('wasooliAmount').value) || 0;
  var note = document.getElementById('wasooliNote').value.trim();
  if (amount <= 0) { showToast('Amount daalein', 'warning'); return; }
  if (!currentAccountShopId) return;
  if (btn) disableButton(btn, 'Saving...');
  var entry = {
    shopId: currentAccountShopId, type: 'payment', amount: amount, note: note,
    date: todayStr(), createdAt: new Date().toISOString(),
    createdBy: currentUser ? currentUser.user : 'unknown',
    businessId: currentBusinessId,
    id: 'local_acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    _offlinePending: !isOnline
  };
  accounts.push(entry);
  if (!isOnline) { offlineAccountsQueue.push(entry); saveAccountsQueueToLocalStorage(); }
  if (firebaseReady && isOnline) {
    var firebaseEntry = JSON.parse(JSON.stringify(entry));
    delete firebaseEntry.id; delete firebaseEntry._offlinePending;
    db.collection('accounts').add(firebaseEntry).then(function(ref) {
      entry.id = ref.id; entry._offlinePending = false;
      if (btn) enableButton(btn); closeWasooliModal();
      showToast('✅ Wasooli save ho gayi', 'success');
      renderAccountDetailEntries();
      var totalEl = document.getElementById('accountDetailTotal');
      if (totalEl) totalEl.textContent = formatRs(getShopTotalKhata(currentAccountShopId));
    }).catch(function(e) {
      if (btn) enableButton(btn); closeWasooliModal();
      showToast('⚠️ Offline save — internet aane par sync hoga', 'warning');
      renderAccountDetailEntries();
    });
  } else {
    if (btn) enableButton(btn); closeWasooliModal();
    showToast(isOnline ? '✅ Wasooli save ho gayi' : '📴 Offline — internet aane par sync hoga', isOnline ? 'success' : 'warning', 3000);
    renderAccountDetailEntries();
    var totalEl = document.getElementById('accountDetailTotal');
    if (totalEl) totalEl.textContent = formatRs(getShopTotalKhata(currentAccountShopId));
  }
}
function openEditWasooliModal(entryId) {
  var entry = null;
  for (var i = 0; i < accounts.length; i++) { if (accounts[i].id === entryId) { entry = accounts[i]; break; } }
  if (!entry) return;
  currentEditingWasooliId = entryId;
  var amountEl = document.getElementById('editWasooliAmount'); var noteEl = document.getElementById('editWasooliNote');
  if (amountEl) amountEl.value = entry.amount || 0;
  if (noteEl) noteEl.value = entry.note || '';
  document.getElementById('editWasooliModal').classList.add('active');
  setTimeout(function() { if (amountEl) amountEl.focus(); }, 200);
}
function closeEditWasooliModal() { document.getElementById('editWasooliModal').classList.remove('active'); currentEditingWasooliId = null; }
function saveEditedWasooli(btn) {
  if (!currentEditingWasooliId) return;
  var amount = parseInt(document.getElementById('editWasooliAmount').value) || 0;
  var note = document.getElementById('editWasooliNote').value.trim();
  if (amount <= 0) { showToast('Amount daalein', 'warning'); return; }
  if (btn) disableButton(btn, 'Updating...');
  var entry = null;
  for (var i = 0; i < accounts.length; i++) { if (accounts[i].id === currentEditingWasooliId) { entry = accounts[i]; break; } }
  if (!entry) { closeEditWasooliModal(); if (btn) enableButton(btn); return; }
  entry.amount = amount; entry.note = note;
  entry.updatedAt = new Date().toISOString();
  entry.updatedBy = currentUser ? currentUser.user : 'unknown';
  if (firebaseReady && isOnline && String(entry.id).indexOf('local_') !== 0) {
    db.collection('accounts').doc(String(entry.id)).update({ amount: amount, note: note, updatedAt: entry.updatedAt, updatedBy: entry.updatedBy }).then(function() {
      if (btn) enableButton(btn); closeEditWasooliModal();
      showToast('✅ Wasooli update ho gayi', 'success');
      renderAccountDetailEntries();
      var totalEl = document.getElementById('accountDetailTotal');
      if (totalEl) totalEl.textContent = formatRs(getShopTotalKhata(currentAccountShopId));
    }).catch(function(e) {
      if (btn) enableButton(btn); closeEditWasooliModal();
      showToast('⚠️ Update local save', 'warning');
      renderAccountDetailEntries();
    });
  } else {
    for (var i = 0; i < offlineAccountsQueue.length; i++) {
      if (offlineAccountsQueue[i].id === entry.id) { offlineAccountsQueue[i].amount = amount; offlineAccountsQueue[i].note = note; break; }
    }
    saveAccountsQueueToLocalStorage();
    if (btn) enableButton(btn); closeEditWasooliModal();
    showToast('✅ Wasooli update (offline)', 'success');
    renderAccountDetailEntries();
  }
}
function openDeleteWasooliModal(entryId) {
  var entry = null;
  for (var i = 0; i < accounts.length; i++) { if (accounts[i].id === entryId) { entry = accounts[i]; break; } }
  if (!entry) return;
  currentDeletingWasooliId = entryId;
  var infoEl = document.getElementById('deleteWasooliInfo');
  if (infoEl) infoEl.textContent = 'Amount: ' + formatRs(entry.amount) + (entry.note ? ' — ' + entry.note : '');
  document.getElementById('deleteWasooliModal').classList.add('active');
}
function closeDeleteWasooliModal() { document.getElementById('deleteWasooliModal').classList.remove('active'); currentDeletingWasooliId = null; }
function confirmDeleteWasooli(btn) {
  if (!currentDeletingWasooliId) return;
  if (btn) disableButton(btn, 'Deleting...');
  var entryId = currentDeletingWasooliId;
  var newAccounts = [];
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i].id === entryId) {
      if (firebaseReady && isOnline && String(accounts[i].id).indexOf('local_') !== 0) {
        db.collection('accounts').doc(String(accounts[i].id)).delete().catch(function(e) { console.log(e); });
      }
    } else newAccounts.push(accounts[i]);
  }
  accounts = newAccounts;
  var newOfflineQ = [];
  for (var i = 0; i < offlineAccountsQueue.length; i++) { if (offlineAccountsQueue[i].id !== entryId) newOfflineQ.push(offlineAccountsQueue[i]); }
  offlineAccountsQueue = newOfflineQ;
  saveAccountsQueueToLocalStorage();
  setTimeout(function() {
    if (btn) enableButton(btn); closeDeleteWasooliModal();
    showToast('✅ Wasooli delete ho gayi', 'success');
    renderAccountDetailEntries();
    var totalEl = document.getElementById('accountDetailTotal');
    if (totalEl) totalEl.textContent = formatRs(getShopTotalKhata(currentAccountShopId));
  }, 200);
}
function addToAccount(shopId, amount, type, orderId, productName, note, maund, kg) {
  var entry = {
    shopId: shopId, type: type, amount: parseInt(amount) || 0,
    orderId: orderId || '', productName: productName || '', note: note || '',
    maund: parseInt(maund) || 0,
    kg: parseInt(kg) || 0,
    date: todayStr(), createdAt: new Date().toISOString(),
    createdBy: currentUser ? currentUser.user : 'unknown',
    businessId: currentBusinessId,
    id: 'local_acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    _offlinePending: !isOnline
  };
  accounts.push(entry);
  if (!isOnline) { offlineAccountsQueue.push(entry); saveAccountsQueueToLocalStorage(); }
  else if (firebaseReady) {
    var firebaseEntry = JSON.parse(JSON.stringify(entry));
    delete firebaseEntry.id; delete firebaseEntry._offlinePending;
    db.collection('accounts').add(firebaseEntry).then(function(ref) {
      entry.id = ref.id; entry._offlinePending = false;
    }).catch(function(e) { console.log('Account add error:', e); });
  }
}
function addOrderAmountToAccountIfNeeded(order) {
  if (!order || !order.shopId) return;
  var shop = getShopById(order.shopId);
  if (!shop) return;
  if (shop.category === 'farzi') return;
  if (order.status !== 'Delivered') return;
  if (order.amountAddedToAccount) return;
  var totalAmt = parseInt(order.totalAmount) || 0;
  if (totalAmt <= 0) return;
  for (var i = 0; i < order.items.length; i++) {
    var itm = order.items[i];
    if (itm.amount && itm.amount > 0) {
      addToAccount(order.shopId, itm.amount, 'order', order.id, itm.product, '', itm.maund, itm.kg);
    }
  }
  order.amountAddedToAccount = true;
  if (firebaseReady && isOnline && String(order.id).indexOf('local_') !== 0) {
    db.collection('orders').doc(String(order.id)).update({ amountAddedToAccount: true }).catch(function(e) { console.log(e); });
  }
}function shareAccountToWhatsapp() {
  if (!currentAccountShopId) return;
  var shop = getShopById(currentAccountShopId);
  if (!shop) return;
  if (!shop.mobile) { showToast('Shopkeeper ka mobile number nahi hai', 'warning', 3000); return; }
  var number = formatWaNumber(shop.mobile);
  if (!number) { showToast('Mobile number galat hai', 'warning', 3000); return; }
  var bizName = settings.bizName || 'Atta Chakki';
  var totalKhata = getShopTotalKhata(currentAccountShopId);
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    '📅 ' + getCurrentDateTimeText() + '\n\n' +
    'Aap ka total khata: ' + formatRs(totalKhata) + '\n\n' +
    'Baqi udhaar: ' + formatRs(totalKhata) + '\n\n' +
    'Shukriya!\n- ' + bizName + '\n\n' +
    '👤 Sent by: ' + getCurrentUserDisplayForWa();
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappUrl = url;
  pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}

function openOrderDetailModal(shopId, options) {
  options = options || {};
  var readOnly = options.readOnly === true;
  var shop = getShopById(shopId);
  if (!shop) return;
  var sOrders = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (readOnly) {
      if (o.status !== 'Delivered') continue;
    } else {
      if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    }
    sOrders.push(o);
  }
  sOrders.sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  currentOrderDetailShopId = shopId;
  currentOrderDetailReadOnly = readOnly;
  var titleEl = document.getElementById('orderDetailTitle');
  if (titleEl) titleEl.textContent = readOnly ? 'Order Detail (History)' : 'Order Detail';
  var body = document.getElementById('orderDetailBody');
  if (!body) return;
  if (sOrders.length === 0) {
    body.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>' + (readOnly ? 'Koi delivered order nahi.' : 'Koi pending order nahi.') + '</div>';
    document.getElementById('orderDetailModal').classList.add('active');
    return;
  }
  var farziTag = (shop.category === 'farzi') ? ' <span class="farzi-badge">FARZI</span>' : '';
  var grandTotal = 0;
  var html = '';
  html += '<div class="order-detail-shop-info">' +
    '<h3><i class="fa fa-store"></i> ' + shop.name + farziTag + '</h3>' +
    '<p><i class="fa fa-phone"></i> ' + shop.mobile + (shop.address ? ' • <i class="fa fa-map-marker-alt"></i> ' + shop.address : '') + '</p>' +
    '</div>';
  for (var i = 0; i < sOrders.length; i++) {
    var o = sOrders[i];
    var orderTotal = 0;
    var itemsHtml = '';
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var rowAmt = parseInt(it.amount) || 0;
      orderTotal += rowAmt;
      var qtyStr = qtyText(it.maund, it.kg);
      itemsHtml += '<div class="order-detail-item-row">' +
        '<span class="odir-name">📦 ' + it.product + '</span>' +
        '<span class="odir-qty">' + qtyStr + '</span>' +
        '<span class="odir-amount">' + formatRs(rowAmt) + '</span>' +
        '</div>';
    }
    grandTotal += orderTotal;
    var statusBadge = '';
    if (o.status === 'Delivered') statusBadge = '<span class="badge delivered">Delivered</span>';
    else if (o.status === 'Partial') statusBadge = '<span class="badge partial">Partial</span>';
    else statusBadge = '<span class="badge pending">Pending</span>';
    var dateTag = '<div class="odh-date"><i class="fa fa-calendar"></i> ' + formatDate(o.date) + ' • ' + getOrderDateTimeText(o) + '</div>';
    html += '<div class="order-detail-card">' +
      '<div class="order-detail-card-head">' +
        '<div class="odh-title"><i class="fa fa-receipt"></i> Order #' + (i + 1) + ' ' + statusBadge + '</div>' +
        dateTag +
      '</div>' +
      '<div class="order-detail-items">' + itemsHtml + '</div>' +
      '<div class="order-detail-card-subtotal">' +
        '<span>Subtotal:</span>' +
        '<strong>' + formatRs(orderTotal) + '</strong>' +
      '</div>';
    if (!readOnly) {
      html += '<button class="order-detail-deliver-btn" onclick="deliverSingleOrderFromModal(\'' + o.id + '\', this)">' +
        '<i class="fa fa-check"></i> Deliver Karein' +
        '</button>';
    }
    html += '</div>';
  }
  html += '<div class="grand-total-box">' +
    '<div class="gt-row">' +
      '<span class="gt-label">💰 Grand Total:</span>' +
      '<span class="gt-value">' + formatRs(grandTotal) + '</span>' +
    '</div>';
  if (!readOnly && sOrders.length > 1) {
    html += '<button class="grand-total-deliver-all-btn" onclick="deliverAllOrdersFromModal(\'' + shopId + '\', this)">' +
      '<i class="fa fa-check-double"></i> Sab Deliver Karein' +
      '</button>';
  }
  html += '</div>';
  body.innerHTML = html;
  document.getElementById('orderDetailModal').classList.add('active');
}
function closeOrderDetailModal() {
  document.getElementById('orderDetailModal').classList.remove('active');
  currentOrderDetailShopId = null;
  currentOrderDetailReadOnly = false;
}
function deliverSingleOrderFromModal(orderId, btn) {
  if (!can('deliver')) { showToast('Permission nahi hai', 'error'); return; }
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) return;
  if (btn) disableButton(btn, 'Delivering...');
  var shop = getShopById(order.shopId);
  var isFarzi = shop && shop.category === 'farzi';
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    it.deliveredMaund = parseInt(it.maund) || 0;
    it.deliveredKg = parseInt(it.kg) || 0;
  }
  order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
  saveToFirebase('orders', order.id, order);
  addOrderAmountToAccountIfNeeded(order);
  setTimeout(function() {
    if (btn) enableButton(btn);
    cleanupRouteAfterDelivery();
    renderOrdersPage(); renderDashboard(); renderDelivery();
    var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
    showToast('✅ Order deliver ho gaya!', 'success');
    if (isFarzi && order.status === 'Delivered') {
      closeOrderDetailModal();
      setTimeout(function() { openFarziDeliverModal(order.id); }, 400);
      return;
    }
    if (currentOrderDetailShopId) {
      setTimeout(function() {
        var stillPending = false;
        for (var i = 0; i < orders.length; i++) {
          var o = orders[i];
          if (o.shopId == currentOrderDetailShopId && (o.status === 'Pending' || o.status === 'Partial')) { stillPending = true; break; }
        }
        if (!stillPending) closeOrderDetailModal();
        else openOrderDetailModal(currentOrderDetailShopId, { readOnly: false });
      }, 500);
    }
    if (shop && shop.mobile && !isFarzi) {
      setTimeout(function() { openWhatsappDeliveredShareModal(order, shop); }, 600);
    }
  }, 300);
}
function deliverAllOrdersFromModal(shopId, btn) {
  if (!can('deliver')) { showToast('Permission nahi hai', 'error'); return; }
  var shop = getShopById(shopId);
  if (!shop) return;
  if (btn) disableButton(btn, 'Delivering...');
  var deliveredOrders = [];
  var isFarzi = shop.category === 'farzi';
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      it.deliveredMaund = parseInt(it.maund) || 0;
      it.deliveredKg = parseInt(it.kg) || 0;
    }
    o.status = checkOrderDelivered(o) ? 'Delivered' : 'Partial';
    saveToFirebase('orders', o.id, o);
    addOrderAmountToAccountIfNeeded(o);
    if (o.status === 'Delivered') deliveredOrders.push(o);
  }
  setTimeout(function() {
    if (btn) enableButton(btn);
    cleanupRouteAfterDelivery();
    renderOrdersPage(); renderDashboard(); renderDelivery();
    var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
    showToast('✅ Saare orders deliver ho gaye!', 'success');
    closeOrderDetailModal();
    if (isFarzi && deliveredOrders.length > 0) {
      setTimeout(function() { openFarziDeliverModal(deliveredOrders[0].id); }, 400);
      return;
    }
    if (shop && shop.mobile && deliveredOrders.length > 0) {
      setTimeout(function() { openWhatsappDeliveredShareModal(deliveredOrders[0], shop); }, 500);
    }
  }, 300);
}

function openPaymentSplitModal(order) {
  if (!order) return;
  currentSplitOrderId = order.id;
  currentSplitItems = [];
  var totalOrderAmount = 0;
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    var amt = parseInt(it.amount) || 0;
    var paidAmt = parseInt(it.paidAmount) || 0;
    var pendAmt = parseInt(it.pendingAmount);
    if (isNaN(pendAmt)) pendAmt = amt - paidAmt;
    totalOrderAmount += amt;
    currentSplitItems.push({
      product: it.product,
      amount: amt,
      paid: paidAmt,
      pending: pendAmt,
      maund: parseInt(it.maund) || 0,
      kg: parseInt(it.kg) || 0
    });
  }
  var orderPaid = parseInt(order.paidAmount) || 0;
  var nameEl = document.getElementById('splitShopName');
  var shop = getShopById(order.shopId);
  if (nameEl && shop) {
    var farziTag = (shop.category === 'farzi') ? ' (Farzi)' : '';
    nameEl.textContent = shop.name + farziTag + ' — ' + getOrderDateTimeText(order);
  }
  var totalEl = document.getElementById('splitTotalAmount');
  if (totalEl) totalEl.textContent = formatRs(totalOrderAmount);
  var paidInput = document.getElementById('splitPaidInput');
  if (paidInput) paidInput.value = orderPaid > 0 ? orderPaid : '';
  renderSplitItemsList();
  updateSplitPendingText();
  document.getElementById('paymentSplitModal').classList.add('active');
}
function closePaymentSplitModal() {
  document.getElementById('paymentSplitModal').classList.remove('active');
  currentSplitOrderId = null;
  currentSplitItems = [];
}
function renderSplitItemsList() {
  var list = document.getElementById('splitItemsList');
  if (!list) return;
  if (currentSplitItems.length === 0) {
    list.innerHTML = '<div class="empty">Koi product nahi.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < currentSplitItems.length; i++) {
    var it = currentSplitItems[i];
    var qtyStr = qtyText(it.maund, it.kg);
    html += '<div class="split-item-row">' +
      '<div class="si-head">' +
        '<span class="si-name">📦 ' + it.product + ' <small style="color:#64748b;font-weight:500;">(' + qtyStr + ')</small></span>' +
        '<span class="si-amount">' + formatRs(it.amount) + '</span>' +
      '</div>' +
      '<div class="si-inputs">' +
        '<div>' +
          '<label>Diya (Rs.)</label>' +
          '<input type="number" class="paid" min="0" max="' + it.amount + '" value="' + it.paid + '" data-idx="' + i + '" oninput="onSplitPaidInput(' + i + ', this.value)" />' +
        '</div>' +
        '<div>' +
          '<label>Pending (Rs.)</label>' +
          '<input type="number" class="pending" min="0" max="' + it.amount + '" value="' + it.pending + '" data-idx="' + i + '" oninput="onSplitPendingInput(' + i + ', this.value)" />' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  list.innerHTML = html;
}
function onSplitPaidInput(idx, val) {
  if (idx < 0 || idx >= currentSplitItems.length) return;
  var it = currentSplitItems[idx];
  var paid = parseInt(val) || 0;
  if (paid < 0) paid = 0;
  if (paid > it.amount) paid = it.amount;
  it.paid = paid;
  it.pending = it.amount - paid;
  var pendingInput = document.querySelector('.split-item-row .pending[data-idx="' + idx + '"]');
  if (pendingInput) pendingInput.value = it.pending;
  recalculateSplitTotal();
}
function onSplitPendingInput(idx, val) {
  if (idx < 0 || idx >= currentSplitItems.length) return;
  var it = currentSplitItems[idx];
  var pending = parseInt(val) || 0;
  if (pending < 0) pending = 0;
  if (pending > it.amount) pending = it.amount;
  it.pending = pending;
  it.paid = it.amount - pending;
  var paidInput = document.querySelector('.split-item-row .paid[data-idx="' + idx + '"]');
  if (paidInput) paidInput.value = it.paid;
  recalculateSplitTotal();
}
function recalculateSplitTotal() {
  var totalPaid = 0;
  for (var i = 0; i < currentSplitItems.length; i++) { totalPaid += currentSplitItems[i].paid; }
  var paidInput = document.getElementById('splitPaidInput');
  if (paidInput) paidInput.value = totalPaid;
  updateSplitPendingText();
}
function updateSplitPendingText() {
  var totalOrder = 0, totalPaid = 0;
  for (var i = 0; i < currentSplitItems.length; i++) {
    totalOrder += currentSplitItems[i].amount;
    totalPaid += currentSplitItems[i].paid;
  }
  var pending = totalOrder - totalPaid;
  var el = document.getElementById('splitPendingText');
  if (el) el.textContent = formatRs(pending);
}
function syncSplitFromPaidInput() {
  var paidInput = document.getElementById('splitPaidInput');
  if (!paidInput) return;
  var totalPaid = parseInt(paidInput.value) || 0;
  if (totalPaid < 0) totalPaid = 0;
  var totalOrder = 0;
  for (var i = 0; i < currentSplitItems.length; i++) totalOrder += currentSplitItems[i].amount;
  if (totalPaid > totalOrder) { totalPaid = totalOrder; paidInput.value = totalPaid; }
  var remaining = totalPaid;
  for (var i = 0; i < currentSplitItems.length; i++) {
    var it = currentSplitItems[i];
    var give = Math.min(it.amount, remaining);
    it.paid = give;
    it.pending = it.amount - give;
    remaining -= give;
  }
  renderSplitItemsList();
  updateSplitPendingText();
}
function savePaymentSplit(btn) {
  if (!currentSplitOrderId) return;
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentSplitOrderId) { order = orders[i]; break; } }
  if (!order) { closePaymentSplitModal(); return; }
  if (btn) disableButton(btn, 'Saving...');
  var totalOrder = 0, totalPaid = 0;
  for (var i = 0; i < currentSplitItems.length; i++) {
    totalOrder += currentSplitItems[i].amount;
    totalPaid += currentSplitItems[i].paid;
  }
  var totalPending = totalOrder - totalPaid;
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    for (var j = 0; j < currentSplitItems.length; j++) {
      if (currentSplitItems[j].product === it.product) {
        it.paidAmount = currentSplitItems[j].paid;
        it.pendingAmount = currentSplitItems[j].pending;
        break;
      }
    }
  }
  order.paidAmount = totalPaid;
  order.pendingAmount = totalPending;
  order.splitUpdatedAt = new Date().toISOString();
  if (totalPending <= 0) {
    order.amountStatus = 'paid';
    order.paidAt = new Date().toISOString();
    order.paidBy = currentUser ? currentUser.user : 'unknown';
  } else {
    order.amountStatus = 'pending';
  }
  if (firebaseReady) {
    db.collection('orders').doc(String(order.id)).update({
      items: order.items,
      paidAmount: order.paidAmount,
      pendingAmount: order.pendingAmount,
      amountStatus: order.amountStatus,
      paidAt: order.paidAt || null,
      paidBy: order.paidBy || null,
      splitUpdatedAt: order.splitUpdatedAt
    }).then(function() {
      if (btn) enableButton(btn);
      closePaymentSplitModal();
      showToast(totalPending <= 0 ? '✅ Poori payment clear!' : '✅ Split save ho gaya — ' + formatRs(totalPending) + ' pending', 'success');
      renderPendingAmounts();
      renderDashboard();
      if (currentFarziCustomerDetailShopId) {
        setTimeout(function() { renderFarziDetailOrders(currentFarziCustomerDetailShopId); }, 200);
      }
    }).catch(function(e) {
      if (btn) enableButton(btn);
      closePaymentSplitModal();
      showToast('⚠️ Local save — internet aane par sync', 'warning');
    });
  } else {
    if (btn) enableButton(btn);
    closePaymentSplitModal();
    showToast('📴 Offline — split local save', 'warning');
  }
}

function openAmountModal() {
  if (currentOrderItems.length === 0) return;
  var list = document.getElementById('amountItemsList');
  var html = '';
  for (var i = 0; i < currentOrderItems.length; i++) {
    var it = currentOrderItems[i];
    html += '<div class="amount-item-row">' +
      '<div class="ai-name">📦 ' + it.product + '</div>' +
      '<div class="ai-qty">' + qtyText(it.maund, it.kg) + '</div>' +
      '<input type="number" min="0" placeholder="Amount (Rs.)" class="amount-input" data-idx="' + i + '" oninput="updateAmountTotal()" />' +
    '</div>';
  }
  if (list) list.innerHTML = html;
  updateAmountTotal();
  document.getElementById('amountModal').classList.add('active');
  setTimeout(function() { var firstInput = document.querySelector('.amount-input'); if (firstInput) firstInput.focus(); }, 300);
}
function closeAmountModal() { document.getElementById('amountModal').classList.remove('active'); pendingOrderForAmount = null; }
function updateAmountTotal() {
  var inputs = document.querySelectorAll('.amount-input');
  var total = 0;
  for (var i = 0; i < inputs.length; i++) { total += parseInt(inputs[i].value) || 0; }
  var el = document.getElementById('amountTotalText');
  if (el) el.textContent = formatRs(total);
}
function saveOrderWithAmount(btn) {
  if (!currentOrderItems || currentOrderItems.length === 0) { showToast('Koi product nahi', 'error'); return; }
  var inputs = document.querySelectorAll('.amount-input');
  var amounts = [];
  for (var i = 0; i < inputs.length; i++) { amounts.push(parseInt(inputs[i].value) || 0); }
  for (var i = 0; i < currentOrderItems.length; i++) { currentOrderItems[i].amount = amounts[i] || 0; }
  if (btn) disableButton(btn, 'Saving...');
  setTimeout(function() { closeAmountModal(); if (btn) enableButton(btn); saveMultiOrderActual(); }, 200);
}
function saveMultiOrderActual() {
  if (isSavingOrder) { console.log('Already saving, skip'); return; }
  if (!selectedShopIdForOrder) { showToast('Shopkeeper select nahi hua', 'error'); return; }
  if (currentOrderItems.length === 0) { showToast('Koi product nahi', 'error'); return; }
  if (!firebaseReady) { showToast('Firebase load nahi hua', 'error'); return; }
  isSavingOrder = true;
  var shopId = selectedShopIdForOrder; var date = todayStr();
  var notes = document.getElementById('orderNotes') ? document.getElementById('orderNotes').value.trim() : '';
  var items = []; var totalKg = 0; var totalAmount = 0;
  for (var i = 0; i < currentOrderItems.length; i++) {
    var it = currentOrderItems[i];
    var rowKg = (it.maund * 40) + it.kg;
    var amt = parseInt(it.amount) || 0;
    items.push({
      product: it.product, maund: it.maund, kg: it.kg,
      deliveredMaund: 0, deliveredKg: 0, totalKg: rowKg, amount: amt,
      paidAmount: 0, pendingAmount: amt
    });
    totalKg += rowKg; totalAmount += amt;
  }
  var newOrder = {
    shopId: shopId, items: items, totalKg: totalKg, totalAmount: totalAmount,
    date: date, notes: notes, status: 'Pending',
    createdBy: currentUser ? currentUser.user : 'unknown',
    createdAt: new Date().toISOString(), amountAddedToAccount: false,
    paidAmount: 0, pendingAmount: totalAmount,
    businessId: currentBusinessId
  };
  var shop = getShopById(shopId);
  var wasOffline = !isOnline;
  var isFarzi = shop && shop.category === 'farzi';
  if (isFarzi) newOrder.amountStatus = 'pending';
  newOrder.id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  newOrder._offlinePending = wasOffline;
  db.collection('orders').add({
    shopId: newOrder.shopId, items: newOrder.items, totalKg: newOrder.totalKg,
    totalAmount: newOrder.totalAmount, date: newOrder.date, notes: newOrder.notes,
    status: newOrder.status, createdBy: newOrder.createdBy, createdAt: newOrder.createdAt,
    amountStatus: newOrder.amountStatus || null, amountAddedToAccount: false,
    paidAmount: 0, pendingAmount: newOrder.totalAmount,
    businessId: currentBusinessId
  }).then(function(ref) {
    newOrder.id = ref.id; newOrder._offlinePending = false;
  }).catch(function(e) {
    console.log('Order add error:', e);
    showToast('❌ Order save nahi ho saka: ' + (e.message || 'Unknown'), 'error', 4000);
  });
  offlineOrdersQueue.push(newOrder);
  setTimeout(function() {
    mergeOfflineOrders(); isSavingOrder = false;
    showToast(wasOffline ? '📴 Offline — order local save' : '✅ Order save ho gaya!', wasOffline ? 'warning' : 'success', 4000);
    prepareOrderForm(); showPage('dashboard');
    if (shop && shop.mobile) { openWhatsappShareModal(newOrder, shop); }
  }, 400);
}
function getFarziPendingTotal(shopId) {
  var total = 0;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (o.status !== 'Delivered') continue;
    var pend = parseInt(o.pendingAmount);
    if (isNaN(pend)) pend = (o.amountStatus === 'pending') ? (parseInt(o.totalAmount) || 0) : 0;
    total += pend;
  }
  return total;
}
function getFarziPendingOrders(shopId) {
  var list = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (o.status !== 'Delivered') continue;
    var pend = parseInt(o.pendingAmount);
    if (isNaN(pend)) pend = (o.amountStatus === 'pending') ? (parseInt(o.totalAmount) || 0) : 0;
    if (pend <= 0) continue;
    list.push(o);
  }
  list.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return list;
}
function renderPendingAmounts() {
  var list = document.getElementById('pendingAmountList');
  var totalEl = document.getElementById('pendingAmountTotal');
  if (!list) return;
  var totalAll = 0; var farziShops = [];
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    if ((s.category || 'regular') !== 'farzi') continue;
    var total = getFarziPendingTotal(s.id);
    if (total > 0) { totalAll += total; farziShops.push({ shop: s, total: total }); }
  }
  if (totalEl) totalEl.textContent = formatRs(totalAll);
  if (farziShops.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Koi pending amount nahi</div>'; return; }
  farziShops.sort(function(a, b) { return b.total - a.total; });
  var html = '';
  for (var i = 0; i < farziShops.length; i++) {
    var fs = farziShops[i];
    var count = getFarziPendingOrders(fs.shop.id).length;
    html += '<div class="pending-shop-card" onclick="openFarziCustomerDetail(\'' + fs.shop.id + '\')">' +
      '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">' +
        '<span class="user-badge farzi">' + getShopInitials(fs.shop.name) + '</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="psc-name">🔵 ' + fs.shop.name + '</div>' +
          '<div class="psc-count">' + count + ' order' + (count > 1 ? 's' : '') + ' pending</div>' +
        '</div></div>' +
      '<div class="psc-total">' + formatRs(fs.total) + '</div>' +
    '</div>';
  }
  list.innerHTML = html;
}
var currentFarziCustomerDetailShopId = null;
function openFarziCustomerDetail(shopId) {
  var shop = getShopById(shopId);
  if (!shop) return;
  currentFarziCustomerDetailShopId = shopId;
  var nameEl = document.getElementById('farziDetailName');
  var mobileEl = document.getElementById('farziDetailMobile');
  if (nameEl) nameEl.textContent = '🔵 ' + shop.name;
  if (mobileEl) mobileEl.innerHTML = '<i class="fa fa-phone"></i> ' + shop.mobile;
  var totalEl = document.getElementById('farziDetailTotal');
  if (totalEl) totalEl.textContent = formatRs(getFarziPendingTotal(shopId));
  renderFarziDetailOrders(shopId);
  showPage('farziCustomerDetail');
}
function renderFarziDetailOrders(shopId) {
  var box = document.getElementById('farziDetailOrders');
  if (!box) return;
  var list = getFarziPendingOrders(shopId);
  if (list.length === 0) { box.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Koi pending order nahi</div>'; return; }
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var o = list[i];
    var itemsText = '';
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var itPaid = parseInt(it.paidAmount) || 0;
      var itPend = parseInt(it.pendingAmount);
      if (isNaN(itPend)) itPend = (parseInt(it.amount) || 0) - itPaid;
      var splitInfo = '';
      if (itPaid > 0 && itPend > 0) {
        splitInfo = ' <small style="color:#16a34a;">✅ ' + formatRs(itPaid) + '</small> <small style="color:#f59e0b;">⏳ ' + formatRs(itPend) + '</small>';
      } else if (itPend > 0) {
        splitInfo = ' <small style="color:#f59e0b;">⏳ ' + formatRs(itPend) + '</small>';
      } else if (itPaid > 0) {
        splitInfo = ' <small style="color:#16a34a;">✅ ' + formatRs(itPaid) + '</small>';
      }
      itemsText += '📦 ' + it.product + ' — ' + qtyText(it.maund, it.kg) + (it.amount ? ' (' + formatRs(it.amount) + ')' : '') + splitInfo + '<br>';
    }
    var pendAmt = parseInt(o.pendingAmount);
    if (isNaN(pendAmt)) pendAmt = parseInt(o.totalAmount) || 0;
    html += '<div class="pending-order-row">' +
      '<div class="por-info">' +
        '<div style="font-weight:700;color:#1e293b;margin-bottom:4px;">📅 ' + formatDate(o.date) + ' — Order</div>' +
        '<div style="font-size:12px;color:#64748b;">' + itemsText + '</div>' +
      '</div>' +
      '<div style="text-align:right;">' +
        '<div class="por-amount">' + formatRs(pendAmt) + '</div>' +
        '<div class="por-actions">' +
          '<button class="btn-paid" onclick="markPendingPaid(\'' + o.id + '\')"><i class="fa fa-check"></i> De Diya</button>' +
          '<button class="btn-split" onclick="openSplitFromOrder(\'' + o.id + '\')"><i class="fa fa-balance-scale"></i> Split</button>' +
        '</div>' +
      '</div></div>';
  }
  box.innerHTML = html;
}
function openSplitFromOrder(orderId) {
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) return;
  openPaymentSplitModal(order);
}
function markPendingPaid(orderId) {
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) return;
  if (!confirm('Pakka poori amount de diya?')) return;
  order.amountStatus = 'paid';
  order.paidAt = new Date().toISOString();
  order.paidBy = currentUser ? currentUser.user : 'unknown';
  order.paidAmount = parseInt(order.totalAmount) || 0;
  order.pendingAmount = 0;
  for (var i = 0; i < order.items.length; i++) {
    order.items[i].paidAmount = parseInt(order.items[i].amount) || 0;
    order.items[i].pendingAmount = 0;
  }
  if (firebaseReady) {
    db.collection('orders').doc(String(order.id)).update({
      amountStatus: 'paid', paidAt: order.paidAt, paidBy: order.paidBy,
      paidAmount: order.paidAmount, pendingAmount: 0, items: order.items
    }).catch(function(e) { console.log(e); });
  }
  showToast('✅ Amount paid mark ho gaya', 'success');
  renderFarziDetailOrders(order.shopId);
  var totalEl = document.getElementById('farziDetailTotal');
  if (totalEl) totalEl.textContent = formatRs(getFarziPendingTotal(order.shopId));
  renderPendingAmounts();
  var shop = getShopById(order.shopId);
  if (shop && shop.mobile) {
    setTimeout(function() { openWhatsappFarziPaidModal(order, shop); }, 500);
  }
}
function closeFarziDeliverModal() { document.getElementById('farziDeliverModal').classList.remove('active'); currentFarziDeliverOrderId = null; }
function openFarziDeliverModal(orderId) {
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) return;
  var shop = getShopById(order.shopId);
  if (!shop) return;
  currentFarziDeliverOrderId = orderId;
  var nameEl = document.getElementById('farziDeliverShopName');
  var amtEl = document.getElementById('farziDeliverAmount');
  if (nameEl) nameEl.textContent = '🔵 ' + shop.name;
  if (amtEl) amtEl.textContent = formatRs(order.totalAmount);
  document.getElementById('farziDeliverModal').classList.add('active');
}
function markFarziDelivered(status, btn) {
  if (!currentFarziDeliverOrderId) return;
  var orderId = currentFarziDeliverOrderId;
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) { closeFarziDeliverModal(); return; }
  if (status === 'pending') {
    closeFarziDeliverModal();
    if (btn) enableButton(btn);
    setTimeout(function() { openPaymentSplitModal(order); }, 300);
    return;
  }
  if (btn) disableButton(btn, 'Saving...');
  order.amountStatus = 'paid';
  order.paidAt = new Date().toISOString();
  order.paidBy = currentUser ? currentUser.user : 'unknown';
  order.paidAmount = parseInt(order.totalAmount) || 0;
  order.pendingAmount = 0;
  for (var i = 0; i < order.items.length; i++) {
    order.items[i].paidAmount = parseInt(order.items[i].amount) || 0;
    order.items[i].pendingAmount = 0;
  }
  if (firebaseReady) {
    db.collection('orders').doc(String(order.id)).update({
      amountStatus: 'paid', paidAt: order.paidAt, paidBy: order.paidBy,
      paidAmount: order.paidAmount, pendingAmount: 0, items: order.items
    }).catch(function(e) { console.log(e); });
  }
  var shop = getShopById(order.shopId);
  setTimeout(function() {
    if (btn) enableButton(btn); closeFarziDeliverModal();
    showToast('✅ Amount paid mark', 'success');
    renderPendingAmounts(); renderDashboard();
    if (shop && shop.mobile) {
      setTimeout(function() { openWhatsappFarziDeliverModal(order, shop, 'paid'); }, 500);
    }
  }, 200);
}
function filterShopkeepers(category, btn) {
  currentFilterCategory = category;
  var tabs = document.querySelectorAll('.farzi-filter-tabs button');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  renderShopkeepers();
}
function openWhatsappFarziDeliverModal(order, shop, status) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile);
  if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var itemsText = formatOrderItemsText(order.items);
  var statusText = status === 'paid' ? '✅ Payment clear ho gayi hai' : '⏳ Payment abhi PENDING hai\nApne order ki payment jald az jald adaa karein.';
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    '📅 ' + getCurrentDateTimeText() + '\n\n' +
    'Aap ka order deliver ho chuka hai:\n\n' + itemsText + '\n\n' +
    '💰 Total Amount: ' + formatRs(order.totalAmount) + '\n' +
    statusText + '\n\n' +
    'Shukriya!\n- ' + bizName + '\n\n' +
    '👤 Delivered by: ' + getCurrentUserDisplayForWa();
  pendingWhatsappUrl = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}
function openWhatsappFarziPaidModal(order, shop) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile);
  if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var itemsText = formatOrderItemsText(order.items);
  var originalDateTime = getOrderDateTimeText(order);
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    '📅 Aaj: ' + getCurrentDateTimeText() + '\n\n' +
    'Aap ne is tarikh (' + originalDateTime + ') ko yeh order karwaya tha:\n\n' + itemsText + '\n\n' +
    '💰 Total Amount: ' + formatRs(order.totalAmount) + '\n' +
    '⏳ Payment pending thi\n' +
    '✅ Ab payment clear ho gayi hai\n\n' +
    'Shukriya!\n- ' + bizName + '\n\n' +
    '👤 Marked by: ' + getCurrentUserDisplayForWa();
  pendingWhatsappUrl = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}
function openWhatsappShareModal(order, shop) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile); if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var itemsText = formatOrderItemsText(order.items);
  var totalAmtText = order.totalAmount ? '\n\n💰 Total Amount: ' + formatRs(order.totalAmount) : '';
  var dateLine = '📅 ' + formatDate(order.date) + ' • ' + getOrderDateTimeText(order);
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' + dateLine + '\n\nAap ka order book ho chuka hai:\n\n' + itemsText + totalAmtText + '\n\nInshallah jald hi deliver ho jayega.\nShukriya!\n- ' + bizName + '\n\n👤 Created by: ' + getCurrentUserDisplayForWa();
  if (!isOnline) {
    saveToWhatsappQueue({ message: msg, mobile: number, shopName: shop.name, type: 'order' });
    showToast('📴 Offline — WhatsApp message queue mein save ho gaya', 'warning', 4000);
    return;
  }
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappUrl = url; pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}
function openWhatsappDeliveredShareModal(order, shop) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile); if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var lines = [];
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    var dm = parseInt(it.deliveredMaund) || 0, dk = parseInt(it.deliveredKg) || 0;
    var amt = parseInt(it.amount) || 0;
    var amtText = amt > 0 ? ' — ' + formatRs(amt) : '';
    if (dm > 0 || dk > 0) lines.push('• ' + it.product + ' — ' + qtyText(dm, dk) + amtText);
    else { var m = parseInt(it.maund) || 0, k = parseInt(it.kg) || 0; lines.push('• ' + it.product + ' — ' + qtyText(m, k) + amtText); }
  }
  var itemsText = lines.join('\n');
  var totalAmtText = order.totalAmount ? '\n\n💰 Total Amount: ' + formatRs(order.totalAmount) : '';
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n📅 ' + getCurrentDateTimeText() + '\n\nAap ka order deliver ho chuka hai:\n\n' + itemsText + totalAmtText + '\n\nShukriya!\n- ' + bizName + '\n\n👤 Delivered by: ' + getCurrentUserDisplayForWa();
  if (!isOnline) { saveToWhatsappQueue({ message: msg, mobile: number, shopName: shop.name, type: 'delivery' }); showToast('📴 Offline — queue mein save', 'warning'); return; }
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappUrl = url; pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}
function openWhatsappMultiDeliveredShareModal(items, shop) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile); if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var lines = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i]; var qtyParts = [];
    if (it.maund > 0) qtyParts.push(it.maund + ' maund');
    for (var k = 0; k < it.kgList.length; k++) qtyParts.push(it.kgList[k] + ' kg');
    if (qtyParts.length === 0 && it.kg > 0) qtyParts.push(it.kg + ' kg');
    var qtyStr = qtyParts.join(', ') || '0 kg';
    lines.push('• ' + it.product + ' — ' + qtyStr);
  }
  var itemsText = lines.join('\n');
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n📅 ' + getCurrentDateTimeText() + '\n\nAap ka order deliver ho chuka hai:\n\n' + itemsText + '\n\nShukriya!\n- ' + bizName + '\n\n👤 Delivered by: ' + getCurrentUserDisplayForWa();
  if (!isOnline) { saveToWhatsappQueue({ message: msg, mobile: number, shopName: shop.name, type: 'delivery' }); showToast('📴 Offline — queue mein save', 'warning'); return; }
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappUrl = url; pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}
function openWhatsappEditShareModal(order, shop, oldItems, newItems) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile); if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var tableLines = [];
  for (var i = 0; i < oldItems.length; i++) {
    var oi = oldItems[i]; var found = false;
    for (var j = 0; j < newItems.length; j++) {
      if (newItems[j].product === oi.product) {
        var oldQty = qtyText(oi.maund, oi.kg); var newQty = qtyText(newItems[j].maund, newItems[j].kg);
        if (oldQty === newQty) tableLines.push('• ' + oi.product + ' — ' + oldQty);
        else { tableLines.push('❌ ' + oi.product + ' — ' + oldQty); tableLines.push('✅ ' + oi.product + ' — ' + newQty); }
        found = true; break;
      }
    }
    if (!found) tableLines.push('❌ ' + oi.product + ' — ' + qtyText(oi.maund, oi.kg));
  }
  for (var j = 0; j < newItems.length; j++) {
    var nj = newItems[j]; var existsOld = false;
    for (var i = 0; i < oldItems.length; i++) { if (oldItems[i].product === nj.product) { existsOld = true; break; } }
    if (!existsOld) tableLines.push('✅ ' + nj.product + ' — ' + qtyText(nj.maund, nj.kg));
  }
  var tableText = tableLines.join('\n');
  var originalDateTime = getOrderDateTimeText(order);
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n📅 ' + getCurrentDateTimeText() + '\n\nAap ne is tarikh (' + originalDateTime + ') ko yeh order diya tha, aur yeh ismein tabdeeli ki gayi hai:\n\n' + tableText + '\n\nShukriya!\n- ' + bizName + '\n\n👤 Updated by: ' + getCurrentUserDisplayForWa();
  if (!isOnline) { saveToWhatsappQueue({ message: msg, mobile: number, shopName: shop.name, type: 'edit' }); showToast('📴 Offline — queue mein save', 'warning'); return; }
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappUrl = url; pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}
function openWhatsappCancelShareModal(order, shop) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile); if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var itemsText = formatOrderItemsText(order.items);
  var originalDateTime = getOrderDateTimeText(order);
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n📅 ' + getCurrentDateTimeText() + '\n\nAap ne is tarikh (' + originalDateTime + ') ko yeh order diya tha, aur yeh cancel ho gaya hai:\n\n' + itemsText + '\n\nShukriya!\n- ' + bizName + '\n\n👤 Cancelled by: ' + getCurrentUserDisplayForWa();
  if (!isOnline) { saveToWhatsappQueue({ message: msg, mobile: number, shopName: shop.name, type: 'cancel' }); showToast('📴 Offline — queue mein save', 'warning'); return; }
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappUrl = url; pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}
function closeWhatsappShareModal() {
  var modal = document.getElementById('whatsappShareModal');
  if (modal) modal.classList.remove('active');
  pendingWhatsappUrl = null; pendingWhatsappMessage = null;
}
function confirmWhatsappShare() {
  if (pendingWhatsappUrl) window.open(pendingWhatsappUrl, '_blank');
  closeWhatsappShareModal();
}
function getShopById(shopId) { for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopId) return shopkeepers[i]; } return null; }
function cleanupRouteAfterDelivery() {
  if (!firebaseReady) return;
  var routesChanged = false;
  for (var r = routes.length - 1; r >= 0; r--) {
    var route = routes[r];
    var items = (route.items || []).slice(); var newItems = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i]; var stillPending = false;
      for (var j = 0; j < orders.length; j++) {
        var o = orders[j];
        if (o.shopId != it.shopId) continue;
        if (o.status !== 'Pending' && o.status !== 'Partial') continue;
        for (var k = 0; k < o.items.length; k++) {
          var oi = o.items[k]; if (oi.product !== it.product) continue;
          var remM = (parseInt(oi.maund) || 0) - (parseInt(oi.deliveredMaund) || 0);
          var remK = (parseInt(oi.kg) || 0) - (parseInt(oi.deliveredKg) || 0);
          if (remM > 0 || remK > 0) { stillPending = true; break; }
        }
        if (stillPending) break;
      }
      if (stillPending) newItems.push(it);
    }
    if (newItems.length !== items.length) {
      if (newItems.length === 0) { deleteFromFirebase('routes', route.id); routes.splice(r, 1); routesChanged = true; }
      else { route.items = newItems; route.updatedAt = new Date().toISOString(); saveToFirebase('routes', route.id, route); routesChanged = true; }
    }
  }
  if (routesChanged) { renderRoutes(); renderDashboardRoutes(); }
}
function autoShiftPendingOrders() {
  // Feature #5: Disabled — orders apni asal date pe rahenge
  console.log('ℹ️ Auto-shift disabled (Feature #5)');
}
function goBack() {
  var activePage = document.querySelector('.page.active');
  if (!activePage) return;
  var pageId = activePage.id;
  if (pageId === 'dashboard') return;
  if (pageId === 'neworder') {
    var step3 = document.getElementById('quantityStep');
    var step2 = document.getElementById('productPickerStep');
    if (step3 && step3.style.display === 'block') { cancelQty(); return; }
    if (step2 && step2.style.display === 'block') { changeShopkeeper(); return; }
    showPage('dashboard'); return;
  }
  showPage('dashboard');
}
function goHome() {
  var activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'dashboard') return;
  showPage('dashboard'); history.pushState({ page: 'dashboard' }, '');
}
function showPinScreen() { showPinScreenOnly(); }
function verifyPin() {
  var entered = document.getElementById('pinInput').value.trim();
  var err = document.getElementById('pinError');
  err.textContent = '';
  if (!entered || entered.length !== 4) { err.textContent = 'PIN 4-digit ka hona chahiye'; return; }
  if (!currentUser || !currentUser.pin) { err.textContent = 'PIN set nahi hai.'; return; }
  if (entered !== String(currentUser.pin)) { err.textContent = 'Ghalat PIN'; document.getElementById('pinInput').value = ''; return; }
  showAppScreenOnly(); showApp();
  setTimeout(function() { checkWhatsappQueueReminder(); }, 1500);
}
function pinForgot() {
  if (!confirm('PIN bhool gaye? Password se login karna hoga.')) return;
  if (currentUser && currentUser.pin) {
    currentUser.pin = '';
    if (firebaseReady && currentUser.id) db.collection('users').doc(String(currentUser.id)).update({ pin: '' }).catch(function(e) { console.log(e); });
  }
  localStorage.setItem('isLoggedIn', 'false'); localStorage.removeItem('currentUser');
  currentUser = null; isLoggedIn = false;
  showLoginScreenOnly();
  document.getElementById('loginUser').value = ''; document.getElementById('loginPass').value = '';
}
function promptPinSetup() { if (currentUser && currentUser.pin) return; document.getElementById('pinSetupBanner').style.display = 'block'; }
function hidePinBanner() { document.getElementById('pinSetupBanner').style.display = 'none'; }
function openPinSetup() {
  document.getElementById('pinSetupTitle').textContent = 'PIN Set Karein';
  document.getElementById('newPin1').value = ''; document.getElementById('newPin2').value = '';
  document.getElementById('pinSetupError').textContent = '';
  document.getElementById('pinSetupModal').classList.add('active');
  setTimeout(function() { document.getElementById('newPin1').focus(); }, 200);
}
function closePinSetup() { document.getElementById('pinSetupModal').classList.remove('active'); }
function savePin() {
  var p1 = document.getElementById('newPin1').value.trim();
  var p2 = document.getElementById('newPin2').value.trim();
  var err = document.getElementById('pinSetupError');
  err.textContent = '';
  if (!p1 || !p2) { err.textContent = 'Dono PIN daalein'; return; }
  if (p1.length !== 4 || !/^\d{4}$/.test(p1)) { err.textContent = 'PIN 4-digit numbers ka hona chahiye'; return; }
  if (p1 !== p2) { err.textContent = 'PIN match nahi kar rahe'; return; }
  if (p1 === '0000') { err.textContent = '0000 PIN nahi rakh sakte'; return; }
  if (!currentUser) { err.textContent = 'User nahi mila'; return; }
  currentUser.pin = p1;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady && currentUser.id) db.collection('users').doc(String(currentUser.id)).update({ pin: p1 }).catch(function(e) { console.log(e); });
  closePinSetup(); hidePinBanner(); renderPinSettings();
  showToast('✅ PIN save ho gaya!', 'success');
}
function removePin() {
  if (!confirm('PIN remove karne hain?')) return;
  if (!currentUser) return;
  currentUser.pin = '';
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady && currentUser.id) db.collection('users').doc(String(currentUser.id)).update({ pin: '' }).catch(function(e) { console.log(e); });
  renderPinSettings(); showToast('PIN remove ho gaya', 'info');
}
function renderPinSettings() {
  var status = document.getElementById('pinStatusText');
  var setBtn = document.getElementById('setPinBtn');
  var remBtn = document.getElementById('removePinBtn');
  if (!status) return;
  if (currentUser && currentUser.pin) {
    status.textContent = '✅ PIN set hai.';
    if (setBtn) setBtn.textContent = 'PIN Change Karein';
    if (remBtn) remBtn.style.display = 'inline-block';
  } else {
    status.textContent = 'PIN abhi set nahi hai.';
    if (setBtn) setBtn.innerHTML = '<i class="fa fa-plus"></i> Set PIN';
    if (remBtn) remBtn.style.display = 'none';
  }
}
function isAdmin() { return currentUser && currentUser.isAdmin === true; }
function can(permission) {
  if (!currentUser) return false;
  if (currentUser.isAdmin) return true;
  if (!currentUser.perms) return false;
  return currentUser.perms[permission] === true;
}
function getSuperAdminCode(callback) {
  if (!firebaseReady) { callback(SUPER_ADMIN_CODE_DEFAULT); return; }
  db.collection('settings').doc('superAdminCode').get().then(function(doc) {
    if (doc.exists && doc.data().code) {
      callback(doc.data().code);
    } else {
      db.collection('settings').doc('superAdminCode').set({ code: SUPER_ADMIN_CODE_DEFAULT, createdAt: new Date().toISOString() });
      callback(SUPER_ADMIN_CODE_DEFAULT);
    }
  }).catch(function(e) {
    console.log('Super admin code fetch error:', e);
    callback(SUPER_ADMIN_CODE_DEFAULT);
  });
}
function doSignup() {
  var bizNameEl = document.getElementById('signupBizName');
  var businessName = bizNameEl ? bizNameEl.value.trim() : '';
  var user = document.getElementById('signupUser').value.trim();
  var pass = document.getElementById('signupPass').value;
  var pass2 = document.getElementById('signupPass2').value;
  var superCodeEl = document.getElementById('signupSuperCode');
  var superCode = superCodeEl ? superCodeEl.value.trim() : '';
  var err = document.getElementById('loginError');
  err.textContent = '';
  if (!businessName) { err.textContent = 'Business ka naam daalein'; return; }
  if (!user || !pass) { err.textContent = 'Username aur password daalein'; return; }
  if (pass.length < 4) { err.textContent = 'Password kam az kam 4 characters'; return; }
  if (pass !== pass2) { err.textContent = 'Password match nahi'; return; }
  if (!superCode) { err.textContent = 'Super Admin Code daalein'; return; }
  if (!firebaseReady) { err.textContent = 'Firebase load nahi hua.'; return; }
  if (!isOnline) { err.textContent = 'Internet zaroori hai'; return; }
  err.textContent = 'Code check kar rahe hain...';
  getSuperAdminCode(function(validCode) {
    if (superCode !== validCode) {
      err.textContent = '❌ Ghalat Super Admin Code. Aap admin account nahi bana sakte.';
      return;
    }
    err.textContent = 'Account bana rahe hain...';
    db.collection('users').where('user', '==', user).get().then(function(snap) {
      if (!snap.empty) { err.textContent = 'Ye username pehle se mojood hai — koi aur username try karein'; return; }
      var newBusinessId = generateBusinessId();
      var adminUser = {
        user: user, pass: pass, display: user, isAdmin: true, pin: '',
        businessId: newBusinessId,
        businessName: businessName,
        perms: { newOrder: true, deliver: true, shopkeepers: true, history: true, settings: true, routes: true, accounts: true },
        menuLayout: JSON.parse(JSON.stringify(DEFAULT_MENU)),
        dashboardLayout: JSON.parse(JSON.stringify(DEFAULT_DASHBOARD)),
        createdAt: new Date().toISOString()
      };
      db.collection('users').add(adminUser).then(function(ref) {
        db.collection('settings').doc('business_' + newBusinessId).set({
          bizName: businessName, businessId: newBusinessId
        }).catch(function(e) { console.log('Business settings error:', e); });
        db.collection('settings').doc('products_' + newBusinessId).set({
          list: ['Aata', 'Besan', 'Chawal ka Atta'], businessId: newBusinessId
        }).catch(function(e) { console.log('Products settings error:', e); });
        err.textContent = '';
        showToast('✅ Admin account ban gaya! Ab login karein.', 'success', 4000);
        hideSignup();
        document.getElementById('loginUser').value = user;
        document.getElementById('loginPass').value = '';
      }).catch(function(e) { err.textContent = 'Error: ' + e.message; });
    }).catch(function(e) { err.textContent = 'Error: ' + e.message; });
  });
}
function doLogin() {
  var user = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;
  var err = document.getElementById('loginError');
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Username aur password daalein'; return; }
  if (!firebaseReady) { err.textContent = 'Firebase load nahi hua.'; return; }
  err.textContent = 'Check kar rahe hain...';
  db.collection('users').where('user', '==', user).get().then(function(snap) {
    if (snap.empty) { err.textContent = 'Ghalat username ya password'; return; }
    var found = null;
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; if (d.pass === pass) found = d; });
    if (!found) { err.textContent = 'Ghalat username ya password'; return; }
    err.textContent = '';
    currentUser = found; isLoggedIn = true;
    currentBusinessId = found.businessId || null;
    currentBusinessName = found.businessName || null;
    localStorage.setItem('isLoggedIn', 'true'); localStorage.setItem('currentUser', JSON.stringify(found));
    if (currentUser.pin && String(currentUser.pin).length === 4) { showPinScreenOnly(); }
    else { showAppScreenOnly(); showApp(); setTimeout(function() { promptPinSetup(); }, 500); }
  }).catch(function(e) {
    var cachedUser = JSON.parse(localStorage.getItem('currentUser'));
    if (cachedUser && cachedUser.user === user && cachedUser.pass === pass) {
      currentUser = cachedUser; isLoggedIn = true;
      currentBusinessId = cachedUser.businessId || null;
      currentBusinessName = cachedUser.businessName || null;
      localStorage.setItem('isLoggedIn', 'true');
      if (currentUser.pin && String(currentUser.pin).length === 4) showPinScreenOnly();
      else { showAppScreenOnly(); showApp(); }
      return;
    }
    err.textContent = 'Login nahi ho saka.';
  });
}
function showSignup() { document.getElementById('signupSection').style.display = 'block'; document.getElementById('signupLinkBox').style.display = 'none'; document.getElementById('loginError').textContent = ''; }
function hideSignup() { 
  document.getElementById('signupSection').style.display = 'none'; 
  document.getElementById('signupLinkBox').style.display = 'block'; 
  document.getElementById('signupBizName').value = '';
  document.getElementById('signupUser').value = ''; 
  document.getElementById('signupPass').value = ''; 
  document.getElementById('signupPass2').value = ''; 
  var sc = document.getElementById('signupSuperCode'); if (sc) sc.value = '';
}
function doLogout() {
  if (!confirm('Logout karna hai?')) return;
  for (var key in snapshotListeners) { if (snapshotListeners[key]) { try { snapshotListeners[key](); } catch (e) {} } }
  snapshotListeners = {}; offlineOrdersQueue = []; offlineRoutesQueue = [];
  isLoggedIn = false; currentUser = null;
  currentBusinessId = null; currentBusinessName = null;
  shopkeepers = []; orders = []; routes = []; accounts = []; whatsappQueue = []; users = [];
  localStorage.setItem('isLoggedIn', 'false'); localStorage.removeItem('currentUser');
  showLoginScreenOnly();
  document.getElementById('pinSetupBanner').style.display = 'none';
  document.getElementById('offlineBanner').style.display = 'none';
  document.getElementById('pendingBanner').style.display = 'none';
  document.getElementById('loginUser').value = ''; document.getElementById('loginPass').value = '';
  hideSignup();
}
function changePassword() {
  var oldP = document.getElementById('oldPass').value;
  var newP = document.getElementById('newPass').value;
  if (!oldP || !newP) { alert('Dono password daalein'); return; }
  if (newP.length < 4) { alert('Password kam az kam 4 characters'); return; }
  if (currentUser.pass !== oldP) { alert('Purana password ghalat hai'); return; }
  currentUser.pass = newP;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady) db.collection('users').doc(String(currentUser.id)).update({ pass: newP });
  document.getElementById('oldPass').value = ''; document.getElementById('newPass').value = '';
  showToast('✅ Password change ho gaya!', 'success');
}
function showApp() {
  loadLayouts(); renderSidebarNav(); applySettings();
  initDateRanges();
  // Feature #7: Default band
  dashboardDateFilterOpen = false;
  var filterEl = document.getElementById('dashboardDateFilter');
  if (filterEl) filterEl.style.display = 'none';
  var editBtn = document.getElementById('editDateBtn');
  if (editBtn) editBtn.style.display = 'inline-block';
  var doneBtn = document.getElementById('doneDateBtn');
  if (doneBtn) doneBtn.style.display = 'none';
  renderDashboard(); renderShopkeepers(); prepareOrderForm();
  renderHistory(); renderSettings(); renderRoutes();
  renderRouteShopPicker(); renderPinSettings();
  applyDashboardLayout(); renderHiddenMenuList(); populateSalesFilters();
  renderAccounts(); renderPendingAmounts(); renderWhatsappQueue();
  updateQueueBadge();
  if (isAdmin()) renderUsers();
  updateOnlineStatus();
  if (firebaseReady) { setupRealtimeListeners(); setTimeout(function() { renderDashboard(); }, 1500); }
  initBackButtonHandling();
  loadAccountsQueueFromLocalStorage();
  setTimeout(function() { if (isOnline) syncOfflineAccountsQueue(); }, 2000);
  setTimeout(function() { cleanupOldQueue(); checkWhatsappQueueReminder(); }, 2500);
}
function manualSync() {
  if (!firebaseReady) { alert('Firebase load nahi hua.'); return; }
  if (!isOnline) { alert('Internet nahi hai.'); return; }
  var btn = document.getElementById('syncBtn');
  var icon = document.getElementById('syncIcon');
  if (icon) icon.className = 'fa fa-sync-alt fa-spin';
  if (btn) btn.disabled = true;
  for (var key in snapshotListeners) { if (snapshotListeners[key]) { try { snapshotListeners[key](); } catch (e) {} } }
  snapshotListeners = {};
  setTimeout(function() {
    setupRealtimeListeners(); syncOfflineAccountsQueue();
    if (icon) icon.className = 'fa fa-sync-alt';
    if (btn) btn.disabled = false;
    showToast('✅ Sync ho gaya!', 'success', 2000);
  }, 600);
}
function renderSidebarNav() {
  var nav = document.getElementById('sidebarNav');
  if (!nav || !menuLayout) return;
  var activePage = 'dashboard';
  var pages = document.querySelectorAll('.page.active');
  if (pages.length > 0) activePage = pages[0].id;
  var activeQueueCount = getPendingQueueCount();
  var html = '';
  for (var i = 0; i < menuLayout.length; i++) {
    var item = menuLayout[i];
    if (!item.show) continue;
    if (item.key === 'neworder' && !can('newOrder')) continue;
    if (item.key === 'shopkeepers' && !can('shopkeepers')) continue;
    if (item.key === 'history' && !can('history')) continue;
    if (item.key === 'settings' && !can('settings')) continue;
    if (item.key === 'users' && !isAdmin()) continue;
    if (item.key === 'routes' && !can('routes')) continue;
    if (item.key === 'accounts' && !can('accounts')) continue;
    if (item.key === 'pendingAmount' && !can('accounts')) continue;
    var activeClass = (activePage === item.key) ? ' active' : '';
    var badge = '';
    if (item.key === 'whatsappQueue' && activeQueueCount > 0) { badge = '<span class="queue-badge">' + activeQueueCount + '</span>'; }
    html += '<button class="nav-btn' + activeClass + '" onclick="showPage(\'' + item.key + '\', this)"><i class="fa ' + item.icon + '"></i> <span>' + item.label + '</span>' + badge + '</button>';
  }
  html += '<button class="nav-btn" onclick="doLogout()"><i class="fa fa-sign-out-alt"></i> <span>Logout</span></button>';
  nav.innerHTML = html;
  if (currentUser) {
    document.getElementById('userNameLabel').textContent = currentUser.display || currentUser.user;
    var roleEl = document.getElementById('userRoleLabel');
    roleEl.textContent = currentUser.isAdmin ? 'Admin' : 'Staff';
    roleEl.className = 'user-role' + (currentUser.isAdmin ? ' admin' : '');
  }
}
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function formatDate(s) { if (!s) return ''; var d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatDateLong(s) { var d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }); }
function toggleSidebar() { var sb = document.getElementById('sidebar'); if (sb) sb.classList.toggle('open'); }
function qtyText(maund, kg) { var m = parseInt(maund) || 0; var k = parseInt(kg) || 0; if (m === 0 && k === 0) return '0 kg'; var parts = []; if (m > 0) parts.push(m + ' maund'); if (k > 0) parts.push(k + ' kg'); return parts.join(' '); }
function totalKgText(totalKg) { var total = parseInt(totalKg) || 0; var m = Math.floor(total / 40); var k = total % 40; return qtyText(m, k); }
function productQtySummary(items) {
  var totalMaund = 0, kgList = [];
  for (var i = 0; i < items.length; i++) { var m = parseInt(items[i].maund) || 0; var k = parseInt(items[i].kg) || 0; totalMaund += m; if (k > 0) kgList.push(k); }
  var parts = []; if (totalMaund > 0) parts.push(totalMaund + ' maund');
  for (var i = 0; i < kgList.length; i++) parts.push(kgList[i] + ' kg');
  if (parts.length === 0) return '0 kg'; return parts.join(', ');
}
function getPendingItemsForProduct(order, product) {
  var pending = [];
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i]; if (it.product !== product) continue;
    var m = parseInt(it.maund) || 0, k = parseInt(it.kg) || 0;
    var dm = parseInt(it.deliveredMaund) || 0, dk = parseInt(it.deliveredKg) || 0;
    var remM = m - dm, remK = k - dk;
    if (remM > 0 || remK > 0) pending.push({ item: it, index: i, maund: remM, kg: remK });
  }
  return pending;
}
function checkOrderDelivered(order) {
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    var m = parseInt(it.maund) || 0, k = parseInt(it.kg) || 0;
    var dm = parseInt(it.deliveredMaund) || 0, dk = parseInt(it.deliveredKg) || 0;
    if (dm < m || dk < k) return false;
  }
  return true;
}
function showPage(pageId, btn) {
  if (pageId === 'neworder' && !can('newOrder')) { alert('Permission nahi hai'); return; }
  if (pageId === 'shopkeepers' && !can('shopkeepers')) { alert('Permission nahi hai'); return; }
  if (pageId === 'history' && !can('history')) { alert('Permission nahi hai'); return; }
  if (pageId === 'settings' && !can('settings')) { alert('Permission nahi hai'); return; }
  if (pageId === 'users' && !isAdmin()) { alert('Sirf Admin'); return; }
  if (pageId === 'routes' && !can('routes')) { alert('Permission nahi hai'); return; }
  if ((pageId === 'accounts' || pageId === 'accountDetail' || pageId === 'pendingAmount' || pageId === 'farziCustomerDetail') && !can('accounts')) { alert('Permission nahi hai'); return; }
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var target = document.getElementById(pageId); if (target) target.classList.add('active');
  var navBtns = document.querySelectorAll('.nav-btn');
  for (var j = 0; j < navBtns.length; j++) navBtns[j].classList.remove('active');
  if (btn) btn.classList.add('active');
  var sb = document.getElementById('sidebar'); if (sb) sb.classList.remove('open');
  if (menuEditMode) {
    menuEditMode = false;
    document.getElementById('menuEditPanel').style.display = 'none';
    document.getElementById('sidebarNav').style.display = 'flex';
    document.getElementById('editMenuBtn').innerHTML = '<i class="fa fa-pen"></i> Edit Menu';
  }
  history.pushState({ page: pageId }, '');
  if (pageId === 'dashboard') { mergeOfflineOrders(); mergeOfflineRoutes(); mergeOfflineAccounts(); renderDashboard(); applyDashboardLayout(); updateDashboardQueueBanner(); }
  if (pageId === 'shopkeepers') renderShopkeepers();
  if (pageId === 'neworder') prepareOrderForm();
  if (pageId === 'orders') { mergeOfflineOrders(); renderOrdersPage(); }
  if (pageId === 'delivery') { mergeOfflineOrders(); renderDelivery(); }
  if (pageId === 'history') { renderHistory(); populateSalesFilters(); renderSalesReport(); }
  if (pageId === 'settings') { renderSettings(); renderPinSettings(); renderHiddenMenuList(); updateSettingsSyncStatus(); }
  if (pageId === 'users') renderUsers();
  if (pageId === 'routes') { renderRoutes(); renderRouteShopPicker(); }
  if (pageId === 'accounts') renderAccounts();
  if (pageId === 'pendingAmount') renderPendingAmounts();
  if (pageId === 'whatsappQueue') renderWhatsappQueue();
  window.scrollTo(0, 0);
}
function applySettings() {
  var t1 = document.getElementById('topbarTitle');
  var t2 = document.getElementById('sidebarTitle');
  if (t1) t1.textContent = settings.bizName;
  if (t2) t2.textContent = settings.bizName;
  document.title = settings.bizName;
  document.body.classList.remove('pc-mode'); document.body.classList.add('mobile-mode');
}
function saveBizName() {
  var el = document.getElementById('setBizName');
  var name = el.value.trim();
  if (!name) { showToast('Naam likhein', 'warning'); return; }
  settings.bizName = name;
  if (currentUser) {
    currentUser.businessName = name;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }
  saveSettingsFirebase(); applySettings(); showToast('✅ Naam save ho gaya!', 'success');
}
function renderSettings() {
  var nameEl = document.getElementById('setBizName'); if (nameEl) nameEl.value = settings.bizName;
  renderProductsList(); updateSettingsSyncStatus();
  var resetBox = document.getElementById('resetDataBox');
  if (resetBox) resetBox.style.display = isAdmin() ? 'block' : 'none';
}
function renderProductsList() {
  var list = document.getElementById('productsList');
  if (!list) return;
  if (products.length === 0) { list.innerHTML = '<p class="hint">Koi product nahi.</p>'; return; }
  var html = '';
  for (var i = 0; i < products.length; i++) html += '<div class="product-chip">' + products[i] + '<button onclick="deleteProduct(' + i + ')">&times;</button></div>';
  list.innerHTML = html;
}
function addProduct() {
  var input = document.getElementById('newProductName');
  var name = input.value.trim();
  if (!name) { showToast('Naam likhein', 'warning'); return; }
  if (products.indexOf(name) !== -1) { showToast('Already mojood hai', 'warning'); return; }
  products.push(name); saveSettingsFirebase(); input.value = '';
  renderProductsList(); renderProductPickerGrid(); populateSalesFilters();
  showToast('✅ Product add ho gaya', 'success');
}
function deleteProduct(i) {
  if (!confirm('Delete: ' + products[i] + '?')) return;
  products.splice(i, 1); saveSettingsFirebase();
  renderProductsList(); renderProductPickerGrid(); populateSalesFilters();
  showToast('Product delete ho gaya', 'info');
}
function saveUser(btn) {
  if (!isAdmin()) { showToast('Sirf Admin', 'error'); return; }
  var id = document.getElementById('userId').value;
  var user = document.getElementById('newUserName').value.trim();
  var pass = document.getElementById('newUserPass').value;
  var display = document.getElementById('newUserDisplay').value.trim();
  if (!user || !pass) { showToast('Username aur password zaroori!', 'warning'); return; }
  if (pass.length < 4) { showToast('Password kam az kam 4 characters', 'warning'); return; }
  db.collection('users').where('user', '==', user).get().then(function(snap) {
    var conflict = false;
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.id !== id && doc.id !== id) conflict = true;
    });
    if (conflict) { showToast('Ye username pehle se mojood hai', 'error'); return; }
    if (btn) disableButton(btn, 'Saving...');
    var perms = {
      newOrder: document.getElementById('permNewOrder').checked,
      deliver: document.getElementById('permDeliver').checked,
      shopkeepers: document.getElementById('permShopkeepers').checked,
      history: document.getElementById('permHistory').checked,
      settings: document.getElementById('permSettings').checked,
      routes: document.getElementById('permRoutes').checked,
      accounts: document.getElementById('permAccounts').checked
    };
    if (id) {
      var updateData = {
        user: user, pass: pass, display: display || user, perms: perms
      };
      db.collection('users').doc(String(id)).update(updateData).then(function() {
        if (btn) enableButton(btn); showToast('✅ User save ho gaya!', 'success'); resetUserForm(); renderUsers();
      }).catch(function(e) { if (btn) enableButton(btn); showToast('❌ ' + e.message, 'error', 4000); });
      return;
    }
    var newUser = {
      user: user, pass: pass, display: display || user, isAdmin: false, perms: perms, pin: '',
      businessId: currentBusinessId,
      businessName: currentBusinessName,
      menuLayout: JSON.parse(JSON.stringify(DEFAULT_MENU)),
      dashboardLayout: JSON.parse(JSON.stringify(DEFAULT_DASHBOARD)),
      createdAt: new Date().toISOString()
    };
    if (firebaseReady) {
      db.collection('users').add(newUser).then(function(ref) {
        newUser.id = ref.id;
        if (btn) enableButton(btn);
        showToast('✅ User save ho gaya!', 'success');
        resetUserForm(); renderUsers();
      }).catch(function(e) { if (btn) enableButton(btn); showToast('❌ ' + e.message, 'error', 4000); });
    } else { if (btn) enableButton(btn); showToast('Firebase load nahi hua', 'error'); }
  }).catch(function(e) { showToast('❌ ' + e.message, 'error'); });
}
function resetUserForm() {
  document.getElementById('userId').value = '';
  document.getElementById('newUserName').value = '';
  document.getElementById('newUserPass').value = '';
  document.getElementById('newUserDisplay').value = '';
  document.getElementById('permNewOrder').checked = true;
  document.getElementById('permDeliver').checked = true;
  document.getElementById('permShopkeepers').checked = false;
  document.getElementById('permHistory').checked = true;
  document.getElementById('permSettings').checked = false;
  document.getElementById('permRoutes').checked = true;
  document.getElementById('permAccounts').checked = true;
  document.getElementById('userFormTitle').textContent = 'Naya User Banayein';
}
function editUser(id) {
  for (var i = 0; i < users.length; i++) {
    if (users[i].id == id) {
      var u = users[i];
      if (u.isAdmin) { alert('Admin ko edit nahi kar sakte'); return; }
      document.getElementById('userId').value = u.id;
      document.getElementById('newUserName').value = u.user;
      document.getElementById('newUserPass').value = u.pass;
      document.getElementById('newUserDisplay').value = u.display || '';
      document.getElementById('permNewOrder').checked = u.perms.newOrder === true;
      document.getElementById('permDeliver').checked = u.perms.deliver === true;
      document.getElementById('permShopkeepers').checked = u.perms.shopkeepers === true;
      document.getElementById('permHistory').checked = u.perms.history === true;
      document.getElementById('permSettings').checked = u.perms.settings === true;
      document.getElementById('permRoutes').checked = u.perms.routes === true;
      document.getElementById('permAccounts').checked = u.perms.accounts === true;
      document.getElementById('userFormTitle').textContent = 'User Edit Karein';
      window.scrollTo(0, 0);
    }
  }
}
function deleteUser(id) {
  if (!isAdmin()) return;
  for (var i = 0; i < users.length; i++) { if (users[i].id == id && users[i].isAdmin) { alert('Admin delete nahi'); return; } }
  if (!confirm('Pakka delete?')) return;
  var newList = [];
  for (var i = 0; i < users.length; i++) { if (users[i].id != id) newList.push(users[i]); else deleteFromFirebase('users', users[i].id); }
  users = newList; renderUsers(); showToast('User delete ho gaya', 'info');
}
function renderUsers() {
  if (!isAdmin()) return;
  var list = document.getElementById('usersList');
  if (!list) return;
  if (users.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-users"></i>Koi user nahi.</div>'; return; }
  var html = '';
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var badge = u.isAdmin ? '<span class="badge admin-badge">ADMIN</span>' : '<span class="badge staff-badge">STAFF</span>';
    var pinBadge = u.pin ? ' <span class="badge delivered" style="background:#e0e7ff;color:#3730a3;">🔒 PIN</span>' : '';
    var chips = '';
    var permsList = [
      { k: 'newOrder', label: 'Naya Order' }, { k: 'deliver', label: 'Deliver' },
      { k: 'shopkeepers', label: 'Shopkeepers' }, { k: 'history', label: 'History' },
      { k: 'settings', label: 'Settings' }, { k: 'routes', label: 'Routes' },
      { k: 'accounts', label: 'Accounts' }
    ];
    for (var j = 0; j < permsList.length; j++) {
      var on = u.isAdmin || (u.perms && u.perms[permsList[j].k] === true);
      chips += '<span class="perm-chip ' + (on ? '' : 'off') + '">' + permsList[j].label + '</span>';
    }
    var actions = '';
    if (!u.isAdmin) {
      actions = '<button class="btn small" onclick="editUser(\'' + u.id + '\')"><i class="fa fa-edit"></i> Edit</button>' +
                '<button class="btn small danger" onclick="deleteUser(\'' + u.id + '\')"><i class="fa fa-trash"></i></button>';
    }
    html += '<div class="item user-item"><div class="item-info">' +
      '<h4>' + getUserBadgeHtml(u.user) + ' ' + (u.display || u.user) + '</h4>' +
      '<p><b>@' + u.user + '</b></p>' + badge + pinBadge +
      '<div class="perm-chips">' + chips + '</div></div>' +
      '<div class="item-actions">' + actions + '</div></div>';
  }
  list.innerHTML = html;
}
function renderDashboard() {
  var dateLabel = document.getElementById('todayDateLabel');
  if (dateLabel) dateLabel.textContent = formatDateLong(todayStr());
  var filteredOrders = [];
  for (var i = 0; i < orders.length; i++) {
    if (isOrderInRange(orders[i].date, dashboardDateRange)) filteredOrders.push(orders[i]);
  }
  var totalOrders = filteredOrders.length;
  var pendingCount = 0, deliveredCount = 0;
  for (var i = 0; i < filteredOrders.length; i++) {
    if (filteredOrders[i].status === 'Pending' || filteredOrders[i].status === 'Partial') pendingCount++;
    else if (filteredOrders[i].status === 'Delivered') deliveredCount++;
  }
  document.getElementById('totalShopkeepers').textContent = shopkeepers.length;
  document.getElementById('todayOrders').textContent = totalOrders;
  document.getElementById('pendingOrders').textContent = pendingCount;
  document.getElementById('deliveredOrders').textContent = deliveredCount;
  var rangeText = '';
  if (dashboardDateRange.from && dashboardDateRange.to) {
    rangeText = formatDate(dashboardDateRange.from) + ' - ' + formatDate(dashboardDateRange.to);
  }
  var lbl1 = document.getElementById('todayOrdersLabel'); if (lbl1) lbl1.textContent = rangeText ? rangeText : 'Selected Range';
  var lbl2 = document.getElementById('pendingOrdersLabel'); if (lbl2) lbl2.textContent = 'Pending';
  var lbl3 = document.getElementById('deliveredOrdersLabel'); if (lbl3) lbl3.textContent = 'Delivered';

  var pendingOrders = [];
  for (var i = 0; i < filteredOrders.length; i++) {
    if (filteredOrders[i].status === 'Pending' || filteredOrders[i].status === 'Partial') pendingOrders.push(filteredOrders[i]);
  }
  var totalKg = 0;
  for (var i = 0; i < pendingOrders.length; i++) {
    var o = pendingOrders[i];
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      totalKg += (remM * 40) + remK;
    }
  }
  document.getElementById('todayLoadBadge').textContent = totalKgText(totalKg);
  var list = document.getElementById('todayLoadList');
  if (pendingOrders.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Is range mein koi pending order nahi.</div>'; }
  else {
    var byProduct = {};
    for (var i = 0; i < pendingOrders.length; i++) {
      var o = pendingOrders[i];
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        var p = it.product;
        if (!byProduct[p]) byProduct[p] = [];
        byProduct[p].push({ maund: remM, kg: remK });
      }
    }
    var rows = ''; var keys = Object.keys(byProduct);
    for (var k = 0; k < keys.length; k++) rows += '<div class="shop-order-line"><span class="product-name">📦 ' + keys[k] + '</span><span class="qty">' + productQtySummary(byProduct[keys[k]]) + '</span></div>';
    list.innerHTML = rows || '<div class="empty">Sab deliver ho gaya!</div>';
  }
  renderPendingShopkeeperList();
  renderDashboardRoutes();
}
function renderPendingShopkeeperList() {
  var list = document.getElementById('pendingShopList');
  var badge = document.getElementById('pendingShopBadge');
  if (!list) return;
  var grouped = {};
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (!isOrderInRange(o.date, dashboardDateRange)) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    if (!grouped[o.shopId]) grouped[o.shopId] = { count: 0, usernames: {}, totalAmount: 0, dates: {} };
    grouped[o.shopId].count++;
    var amt = parseInt(o.totalAmount) || 0;
    grouped[o.shopId].totalAmount += amt;
    if (o.date) grouped[o.shopId].dates[o.date] = true;
    if (o.createdBy) grouped[o.shopId].usernames[o.createdBy] = true;
  }
  var shopIds = Object.keys(grouped);
  if (badge) badge.textContent = shopIds.length;
  if (shopIds.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Is range mein koi pending shopkeeper order nahi.</div>'; return; }
  var html = '';
  for (var k = 0; k < shopIds.length; k++) {
    var sid = shopIds[k]; var shopName = 'Unknown'; var hasOffline = false; var shopObj = null;
    for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == sid) { shopName = shopkeepers[i].name; shopObj = shopkeepers[i]; } }
    for (var i = 0; i < orders.length; i++) { if (orders[i].shopId == sid && orders[i]._offlinePending) { hasOffline = true; break; } }
    var count = grouped[sid].count;
    var totalAmt = grouped[sid].totalAmount;
    var offlineClass = hasOffline ? ' offline-pending' : '';
    var farziClass = (shopObj && shopObj.category === 'farzi') ? ' farzi-card' : '';
    var userBadgesHtml = '';
    var usernames = Object.keys(grouped[sid].usernames);
    for (var u = 0; u < usernames.length; u++) userBadgesHtml += getUserBadgeHtml(usernames[u], 'tiny');
    var datesArr = Object.keys(grouped[sid].dates).sort();
    var dateSummary = '';
    if (datesArr.length > 0 && datesArr.length <= 3) {
      dateSummary = '📅 ' + datesArr.map(function(d) { return formatDate(d); }).join(', ');
    } else if (datesArr.length > 3) {
      dateSummary = '📅 ' + formatDate(datesArr[0]) + ' … ' + formatDate(datesArr[datesArr.length - 1]) + ' (' + datesArr.length + ' dates)';
    }
    html += '<div class="pending-shop-name' + offlineClass + farziClass + '" onclick="openPendingShopModal(\'' + sid + '\')">' +
      '<div class="psn-info">' +
        '<span class="name-text"><i class="fa fa-store shop-icon"></i> ' + shopName + ' ' + userBadgesHtml + '</span>' +
        (dateSummary ? '<span class="psn-dates">' + dateSummary + '</span>' : '') +
        (totalAmt > 0 ? '<span class="psn-amount">💰 ' + formatRs(totalAmt) + '</span>' : '') +
      '</div>' +
      '<span><span class="order-count">' + count + '</span><i class="fa fa-chevron-right arrow-icon"></i></span></div>';
  }
  list.innerHTML = html;
}
function openPendingShopModal(shopId) {
  var shopName = 'Unknown', shopMobile = '';
  for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; shopMobile = shopkeepers[i].mobile; } }
  document.getElementById('pendingShopTitle').textContent = shopName + ' - Orders';
  document.getElementById('pendingShopModal').setAttribute('data-shop-id', shopId);
  currentPendingShopId = shopId;
  var sOrders = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (!isOrderInRange(o.date, dashboardDateRange)) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    sOrders.push(o);
  }
  var body = document.getElementById('pendingShopBody');
  if (sOrders.length === 0) { body.innerHTML = '<div class="empty">Koi pending order nahi.</div>'; document.getElementById('pendingShopModal').classList.add('active'); currentPendingProducts = []; return; }
  var productMap = {}; var productOrder = [];
  for (var i = 0; i < sOrders.length; i++) {
    var o = sOrders[i];
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      if (remM <= 0 && remK <= 0) continue;
      var pName = it.product;
      if (!productMap[pName]) { productMap[pName] = { maund: 0, kg: 0, kgList: [], orderIds: [], amount: 0, dates: {} }; productOrder.push(pName); }
      productMap[pName].maund += remM; productMap[pName].kg += remK;
      productMap[pName].amount += (parseInt(it.amount) || 0);
      if (remK > 0) productMap[pName].kgList.push(remK);
      if (productMap[pName].orderIds.indexOf(o.id) === -1) productMap[pName].orderIds.push(o.id);
      if (o.date) productMap[pName].dates[o.date] = true;
    }
  }
  var grandTotalKg = 0; currentPendingProducts = [];
  for (var p = 0; p < productOrder.length; p++) {
    var pm = productMap[productOrder[p]];
    grandTotalKg += (pm.maund * 40) + pm.kg;
    currentPendingProducts.push({ product: productOrder[p], maund: pm.maund, kg: pm.kg, kgList: pm.kgList.slice(), orderIds: pm.orderIds.slice(), amount: pm.amount, dates: pm.dates });
  }
  var linesHtml = '';
  for (var p = 0; p < currentPendingProducts.length; p++) {
    var pd = currentPendingProducts[p];
    var qtyParts = [];
    if (pd.maund > 0) qtyParts.push(pd.maund + ' maund');
    for (var q = 0; q < pd.kgList.length; q++) qtyParts.push(pd.kgList[q] + ' kg');
    var qtyStr = qtyParts.join(', ') || '0 kg';
    var amtTag = pd.amount > 0 ? '<span class="amt-tag">' + formatRs(pd.amount) + '</span>' : '';
    var datesArr = Object.keys(pd.dates).sort();
    var dateTag = '';
    if (datesArr.length > 0) {
      if (datesArr.length === 1) dateTag = '<span class="date-tag">📅 ' + formatDate(datesArr[0]) + '</span>';
      else dateTag = '<span class="date-tag">📅 ' + formatDate(datesArr[0]) + ' … ' + formatDate(datesArr[datesArr.length - 1]) + '</span>';
    }
    linesHtml += '<div class="product-line selectable-line">' +
      '<label class="deliver-checkbox"><input type="checkbox" class="pending-item-check" data-idx="' + p + '" onchange="updateDeliverBtn()" /></label>' +
      '<div class="product-line-info"><span class="p-name">📦 ' + pd.product + '</span><span class="p-qty">' + qtyStr + '</span>' + amtTag + dateTag + '</div>' +
    '</div>';
  }
  var deliverBtnHtml = can('deliver') ? '<button class="btn primary small deliver-selected-btn" onclick="deliverSelectedItems(this)" id="deliverSelectedBtn" disabled><i class="fa fa-check"></i> Deliver (<span id="deliverCount">0</span>)</button>' : '';
  var selectAllHtml = '<button class="btn small" onclick="toggleSelectAllPending()" id="selectAllPendingBtn" style="width:100%;margin-top:10px;"><i class="fa fa-check-square"></i> Select All</button>';
  var html = '<div class="shop-group"><div class="shop-group-head">' +
    '<div style="flex:1;"><h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
    '<p><i class="fa fa-phone"></i> ' + shopMobile + '</p></div>' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="shop-group-total">' + totalKgText(grandTotalKg) + '</span>' + deliverBtnHtml + '</div>' +
    '</div>' + linesHtml + selectAllHtml + '</div>';
  body.innerHTML = html;
  document.getElementById('pendingShopModal').classList.add('active');
}
function updateDeliverBtn() {
  var checks = document.querySelectorAll('.pending-item-check');
  var count = 0;
  for (var i = 0; i < checks.length; i++) { if (checks[i].checked) count++; }
  var btn = document.getElementById('deliverSelectedBtn');
  var countSpan = document.getElementById('deliverCount');
  if (countSpan) countSpan.textContent = count;
  if (btn) btn.disabled = (count === 0);
}
function toggleSelectAllPending() {
  var checks = document.querySelectorAll('.pending-item-check');
  var allChecked = true;
  for (var i = 0; i < checks.length; i++) { if (!checks[i].checked) { allChecked = false; break; } }
  for (var i = 0; i < checks.length; i++) checks[i].checked = !allChecked;
  var btn = document.getElementById('selectAllPendingBtn');
  if (btn) { if (allChecked) btn.innerHTML = '<i class="fa fa-check-square"></i> Select All'; else btn.innerHTML = '<i class="fa fa-square"></i> Deselect All'; }
  updateDeliverBtn();
}
function deliverSelectedItems(btn) {
  if (!can('deliver')) { showToast('Permission nahi hai', 'error'); return; }
  var checks = document.querySelectorAll('.pending-item-check');
  var selectedIdx = [];
  for (var i = 0; i < checks.length; i++) { if (checks[i].checked) selectedIdx.push(parseInt(checks[i].getAttribute('data-idx'))); }
  if (selectedIdx.length === 0) { showToast('Kam az kam ek product select karein!', 'warning'); return; }
  if (btn) disableButton(btn, 'Delivering...');
  var shopId = currentPendingShopId; var shop = getShopById(shopId); var deliveredItemsForWa = [];
  var isFarziShop = shop && shop.category === 'farzi';
  var deliveredOrderIds = [];
  for (var s = 0; s < selectedIdx.length; s++) {
    var pd = currentPendingProducts[selectedIdx[s]]; if (!pd) continue;
    for (var i = 0; i < pd.orderIds.length; i++) {
      var oid = pd.orderIds[i]; var order = null;
      for (var j = 0; j < orders.length; j++) { if (orders[j].id == oid) { order = orders[j]; break; } }
      if (!order) continue;
      for (var k = 0; k < order.items.length; k++) {
        var it = order.items[k]; if (it.product !== pd.product) continue;
        it.deliveredMaund = parseInt(it.maund) || 0; it.deliveredKg = parseInt(it.kg) || 0;
      }
      order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
      saveToFirebase('orders', order.id, order);
      addOrderAmountToAccountIfNeeded(order);
      if (isFarziShop && order.status === 'Delivered' && deliveredOrderIds.indexOf(order.id) === -1) deliveredOrderIds.push(order.id);
    }
    deliveredItemsForWa.push({ product: pd.product, maund: pd.maund, kg: pd.kg, kgList: pd.kgList.slice() });
  }
  setTimeout(function() {
    if (btn) enableButton(btn);
    cleanupRouteAfterDelivery(); refreshPendingShopModal();
    showToast('✅ Delivered mark ho gaya!', 'success');
    if (isFarziShop && deliveredOrderIds.length > 0) { openFarziDeliverModal(deliveredOrderIds[0]); }
    else if (shop && shop.mobile && deliveredItemsForWa.length > 0) { openWhatsappMultiDeliveredShareModal(deliveredItemsForWa, shop); }
  }, 300);
}
function closePendingShopModal() {
  document.getElementById('pendingShopModal').classList.remove('active');
  document.getElementById('pendingShopModal').removeAttribute('data-shop-id');
  currentPendingShopId = null; currentPendingProducts = [];
}
function refreshPendingShopModal() {
  var modal = document.getElementById('pendingShopModal'); if (!modal) return;
  var currentShopId = modal.getAttribute('data-shop-id'); if (!currentShopId) { closePendingShopModal(); return; }
  var stillPending = false;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId == currentShopId && isOrderInRange(o.date, dashboardDateRange) && (o.status === 'Pending' || o.status === 'Partial')) { stillPending = true; break; }
  }
  if (!stillPending) closePendingShopModal(); else openPendingShopModal(currentShopId);
}
function saveShopkeeper(btn) {
  if (!can('shopkeepers')) { showToast('Permission nahi hai', 'error'); return; }
  var id = document.getElementById('shopId').value;
  var name = document.getElementById('shopName').value.trim();
  var mobile = document.getElementById('shopMobile').value.trim();
  var address = document.getElementById('shopAddress').value.trim();
  var categoryEl = document.querySelector('input[name="shopCategory"]:checked');
  var category = categoryEl ? categoryEl.value : 'regular';
  if (!name || !mobile) { showToast('Naam aur mobile zaroori!', 'warning'); return; }
  if (btn) disableButton(btn, 'Saving...');
  var wasOffline = !isOnline;
  if (id) {
    for (var i = 0; i < shopkeepers.length; i++) {
      if (shopkeepers[i].id == id) {
        shopkeepers[i].name = name; shopkeepers[i].mobile = mobile;
        shopkeepers[i].address = address; shopkeepers[i].category = category;
        saveToFirebase('shopkeepers', shopkeepers[i].id, shopkeepers[i]);
      }
    }
    setTimeout(function() {
      if (btn) enableButton(btn); resetShopForm(); renderShopkeepers(); populateSalesFilters();
      showToast(wasOffline ? '📴 Offline — local save' : '✅ Shopkeeper save!', wasOffline ? 'warning' : 'success', 4000);
    }, 300);
    return;
  }
  var newShop = { name: name, mobile: mobile, address: address, category: category, createdAt: new Date().toISOString(), businessId: currentBusinessId };
  if (firebaseReady) {
    db.collection('shopkeepers').add(newShop).then(function(ref) {
      newShop.id = ref.id;
      if (btn) enableButton(btn);
      resetShopForm(); renderShopkeepers(); populateSalesFilters();
      showToast(wasOffline ? '📴 Offline — local save' : '✅ Shopkeeper save!', wasOffline ? 'warning' : 'success', 4000);
    }).catch(function(e) { if (btn) enableButton(btn); showToast('❌ ' + (e.message || 'Error'), 'error', 4000); });
  } else { if (btn) enableButton(btn); showToast('Firebase load nahi hua', 'error'); }
}
function resetShopForm() {
  document.getElementById('shopId').value = '';
  document.getElementById('shopName').value = '';
  document.getElementById('shopMobile').value = '';
  document.getElementById('shopAddress').value = '';
  var regRadio = document.querySelector('input[name="shopCategory"][value="regular"]');
  if (regRadio) regRadio.checked = true;
  document.getElementById('shopFormTitle').textContent = 'Naya Shopkeeper Add Karein';
}
function editShopkeeper(id) {
  if (!can('shopkeepers')) { showToast('Permission nahi hai', 'error'); return; }
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == id) {
      var s = shopkeepers[i];
      document.getElementById('shopId').value = s.id;
      document.getElementById('shopName').value = s.name;
      document.getElementById('shopMobile').value = s.mobile;
      document.getElementById('shopAddress').value = s.address || '';
      var cat = s.category || 'regular';
      var radio = document.querySelector('input[name="shopCategory"][value="' + cat + '"]');
      if (radio) radio.checked = true;
      document.getElementById('shopFormTitle').textContent = 'Edit Karein';
    }
  }
  window.scrollTo(0, 0);
}
function deleteShopkeeper(id) {
  if (!can('shopkeepers')) { showToast('Permission nahi hai', 'error'); return; }
  if (!confirm('Pakka delete?')) return;
  var newList = [];
  for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id != id) newList.push(shopkeepers[i]); else deleteFromFirebase('shopkeepers', shopkeepers[i].id); }
  shopkeepers = newList; renderShopkeepers(); populateSalesFilters();
  showToast('Shopkeeper delete ho gaya', 'info');
}
function renderShopkeepers() {
  var list = document.getElementById('shopkeepersList');
  if (!list) return;
  var filtered = [];
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    if (currentFilterCategory !== 'all') {
      var cat = s.category || 'regular';
      if (cat !== currentFilterCategory) continue;
    }
    filtered.push(s);
  }
  if (filtered.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-users"></i>Koi shopkeeper nahi.</div>'; return; }
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var s = filtered[i]; var total = 0, pending = 0;
    for (var j = 0; j < orders.length; j++) { if (orders[j].shopId == s.id) { total++; if (orders[j].status === 'Pending' || orders[j].status === 'Partial') pending++; } }
    var editBtns = '';
    if (can('shopkeepers')) {
      editBtns = '<button class="btn small" onclick="editShopkeeper(\'' + s.id + '\')"><i class="fa fa-edit"></i> Edit</button>' +
                 '<button class="btn small danger" onclick="deleteShopkeeper(\'' + s.id + '\')"><i class="fa fa-trash"></i></button>';
    }
    var isFarzi = s.category === 'farzi';
    var cardClass = isFarzi ? 'farzi-card' : '';
    var farziTag = isFarzi ? ' <span class="farzi-badge">FARZI</span>' : '';
    html += '<div class="item ' + cardClass + '"><div class="item-info">' +
      '<h4><i class="fa fa-store"></i> ' + s.name + farziTag + '</h4>' +
      '<p><i class="fa fa-phone"></i> ' + s.mobile + '</p>' +
      (s.address ? '<p><i class="fa fa-map-marker-alt"></i> ' + s.address + '</p>' : '') +
      '<p><small>' + total + ' total • ' + pending + ' pending</small></p></div>' +
      '<div class="item-actions"><button class="btn small" onclick="viewShopHistory(\'' + s.id + '\')"><i class="fa fa-history"></i> History</button>' + editBtns + '</div></div>';
  }
  list.innerHTML = html;
  if (!can('shopkeepers')) { var form = document.getElementById('shopkeeperFormBox'); if (form) form.style.display = 'none'; }
}
function generateRouteName() {
  var nextNum = routes.length + 1; var names = {};
  for (var i = 0; i < routes.length; i++) names[routes[i].name] = true;
  while (names['Route ' + nextNum]) nextNum++;
  return 'Route ' + nextNum;
}
function updateRouteNameField() {
  var el = document.getElementById('routeName'); if (!el) return;
  var id = document.getElementById('routeId').value;
  if (id) { for (var i = 0; i < routes.length; i++) { if (routes[i].id == id) { el.value = routes[i].name; return; } } }
  el.value = generateRouteName();
}
function shopHasPendingOrderInRange(shopId, range) {
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (!isOrderInRange(o.date, range)) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    return true;
  }
  return false;
}
function getShopTodayProducts(shopId) {
  var productMap = {}, productOrder = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (!isOrderInRange(o.date, dashboardDateRange)) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      if (remM <= 0 && remK <= 0) continue;
      var pName = it.product;
      if (!productMap[pName]) { productMap[pName] = { maund: 0, kgList: [] }; productOrder.push(pName); }
      productMap[pName].maund += remM;
      if (remK > 0) productMap[pName].kgList.push(remK);
    }
  }
  var result = [];
  for (var p = 0; p < productOrder.length; p++) {
    var name = productOrder[p]; var d = productMap[name]; var qtyParts = [];
    if (d.maund > 0) qtyParts.push(d.maund + ' maund');
    for (var k = 0; k < d.kgList.length; k++) qtyParts.push(d.kgList[k] + ' kg');
    result.push({ product: name, qtyStr: qtyParts.join(', ') || '0 kg' });
  }
  return result;
}
function renderRouteShopPicker() {
  var box = document.getElementById('routeShopPicker'); if (!box) return;
  var currentRouteId = document.getElementById('routeId').value || null;
  var shopRouteMap = {};
  for (var r = 0; r < routes.length; r++) {
    var route = routes[r];
    if (route.id === currentRouteId) continue;
    var rItems = route.items || []; var routeShops = {};
    for (var i = 0; i < rItems.length; i++) routeShops[rItems[i].shopId] = true;
    for (var sid in routeShops) { if (!shopRouteMap[sid]) shopRouteMap[sid] = route; }
  }
  var visible = [];
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    if (shopRouteMap[s.id]) continue;
    if (!shopHasPendingOrderInRange(s.id, dashboardDateRange)) continue;
    visible.push(s);
  }
  if (visible.length === 0) { box.innerHTML = '<div class="route-empty-hint"><i class="fa fa-inbox"></i>Is range mein koi free shopkeeper pending order nahi hai.</div>'; return; }
  var html = '';
  for (var i = 0; i < visible.length; i++) {
    var s = visible[i];
    var shopProducts = getShopTodayProducts(s.id);
    var selectedProducts = selectedRouteItems[s.id] || [];
    var shopSelected = selectedProducts.length > 0;
    var shopClass = 'route-shop-block'; if (shopSelected) shopClass += ' selected';
    if (s.category === 'farzi') shopClass += ' farzi-card';
    html += '<div class="' + shopClass + '">' +
      '<div class="route-shop-head">' +
        '<input type="checkbox" ' + (shopSelected ? 'checked' : '') + ' onchange="toggleRouteShop(\'' + s.id + '\', this.checked)" />' +
        '<span class="rsh-name"><i class="fa fa-store"></i> ' + s.name + (s.category === 'farzi' ? ' <span class="farzi-badge">FARZI</span>' : '') + '</span>' +
      '</div>' +
      '<div class="route-shop-products ' + (shopSelected ? '' : 'shop-not-selected') + '">';
    for (var p = 0; p < shopProducts.length; p++) {
      var prod = shopProducts[p];
      var isProdSelected = selectedProducts.indexOf(prod.product) !== -1;
      var prodClass = 'route-product-item' + (isProdSelected ? ' selected' : '');
      html += '<label class="' + prodClass + '">' +
        '<input type="checkbox" ' + (isProdSelected ? 'checked' : '') + ' ' + (shopSelected ? '' : 'disabled') + ' onchange="toggleRouteProduct(\'' + s.id + '\', \'' + prod.product.replace(/'/g, "\\'") + '\', this.checked)" />' +
        '<span class="rpi-name">📦 ' + prod.product + '</span>' +
        '<span class="rpi-qty">' + prod.qtyStr + '</span>' +
      '</label>';
    }
    html += '</div></div>';
  }
  box.innerHTML = html;
}
function toggleRouteShop(shopId, checked) {
  if (checked) {
    var shopProducts = getShopTodayProducts(shopId); selectedRouteItems[shopId] = [];
    for (var i = 0; i < shopProducts.length; i++) selectedRouteItems[shopId].push(shopProducts[i].product);
  } else { delete selectedRouteItems[shopId]; }
  renderRouteShopPicker();
}
function toggleRouteProduct(shopId, product, checked) {
  if (!selectedRouteItems[shopId]) selectedRouteItems[shopId] = [];
  var arr = selectedRouteItems[shopId]; var idx = arr.indexOf(product);
  if (checked) { if (idx === -1) arr.push(product); }
  else { if (idx !== -1) arr.splice(idx, 1); }
  if (arr.length === 0) delete selectedRouteItems[shopId];
  renderRouteShopPicker();
}
function saveRoute(btn) {
  if (!can('routes')) { showToast('Permission nahi hai', 'error'); return; }
  var id = document.getElementById('routeId').value;
  var name = document.getElementById('routeName').value.trim();
  if (!name) name = generateRouteName();
  var items = []; var shopIds = Object.keys(selectedRouteItems);
  for (var i = 0; i < shopIds.length; i++) {
    var sid = shopIds[i]; var prods = selectedRouteItems[sid] || [];
    for (var j = 0; j < prods.length; j++) items.push({ shopId: sid, product: prods[j] });
  }
  if (items.length === 0) { showToast('Kam az kam ek product chunein!', 'warning'); return; }
  var currentRouteId = id || null; var conflictShops = [];
  for (var r = 0; r < routes.length; r++) {
    var route = routes[r];
    if (route.id === currentRouteId) continue;
    var rItems = route.items || [];
    for (var i = 0; i < rItems.length; i++) {
      for (var j = 0; j < items.length; j++) {
        if (rItems[i].shopId === items[j].shopId) {
          var shopName = 'Unknown';
          for (var k = 0; k < shopkeepers.length; k++) { if (shopkeepers[k].id == rItems[i].shopId) shopName = shopkeepers[k].name; }
          conflictShops.push(shopName + ' (' + route.name + ')');
        }
      }
    }
  }
  if (conflictShops.length > 0) {
    var uniqueConflicts = [];
    for (var i = 0; i < conflictShops.length; i++) { if (uniqueConflicts.indexOf(conflictShops[i]) === -1) uniqueConflicts.push(conflictShops[i]); }
    showToast('⚠️ Yeh shopkeeper already kisi route mein hai: ' + uniqueConflicts.join(', '), 'error', 5000);
    return;
  }
  if (btn) disableButton(btn, 'Saving...');
  var wasOffline = !isOnline;
  for (var r = 0; r < routes.length; r++) {
    var route = routes[r];
    if (route.id === currentRouteId) continue;
    var rItems = (route.items || []).slice(); var newItems = []; var changed = false;
    for (var i = 0; i < rItems.length; i++) {
      var ri = rItems[i]; var conflict = false;
      for (var j = 0; j < items.length; j++) { if (items[j].shopId === ri.shopId && items[j].product === ri.product) { conflict = true; break; } }
      if (conflict) changed = true; else newItems.push(ri);
    }
    if (changed) {
      if (newItems.length === 0) { deleteFromFirebase('routes', route.id); routes.splice(r, 1); r--; }
      else { route.items = newItems; route.updatedAt = new Date().toISOString(); saveToFirebase('routes', route.id, route); }
    }
  }
  if (id) {
    for (var i = 0; i < routes.length; i++) {
      if (routes[i].id == id) {
        routes[i].name = name; routes[i].items = items.slice();
        routes[i].updatedAt = new Date().toISOString(); delete routes[i].shopIds;
        saveToFirebase('routes', routes[i].id, routes[i]);
      }
    }
    setTimeout(function() {
      if (btn) enableButton(btn);
      showToast(wasOffline ? '📴 Offline — local save' : '✅ Route update ho gaya!', wasOffline ? 'warning' : 'success', 4000);
      resetRouteForm(); renderRoutes(); showPage('dashboard');
    }, 300);
    return;
  }
  var newRoute = { name: name, items: items, createdBy: currentUser ? currentUser.user : 'unknown', createdAt: new Date().toISOString(), businessId: currentBusinessId };
  newRoute.id = 'local_route_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  if (firebaseReady) {
    db.collection('routes').add({ name: newRoute.name, items: newRoute.items, createdBy: newRoute.createdBy, createdAt: newRoute.createdAt, businessId: currentBusinessId }).then(function(ref) { newRoute.id = ref.id; }).catch(function(e) { console.log('Route add error:', e); });
    offlineRoutesQueue.push(newRoute);
    setTimeout(function() {
      mergeOfflineRoutes();
      if (btn) enableButton(btn);
      showToast(wasOffline ? '📴 Offline — local save' : '✅ Route ban gaya: ' + name, wasOffline ? 'warning' : 'success', 4000);
      resetRouteForm(); renderRoutes(); showPage('dashboard');
    }, 200);
  } else { if (btn) enableButton(btn); showToast('Firebase load nahi hua', 'error'); }
}
function resetRouteForm() {
  document.getElementById('routeId').value = ''; selectedRouteItems = {};
  document.getElementById('routeFormTitle').textContent = 'Naya Route Banayein';
  updateRouteNameField(); renderRouteShopPicker();
}
function editRoute(id) {
  if (!can('routes')) { showToast('Permission nahi hai', 'error'); return; }
  for (var i = 0; i < routes.length; i++) {
    if (routes[i].id == id) {
      var r = routes[i];
      document.getElementById('routeId').value = r.id;
      document.getElementById('routeName').value = r.name;
      selectedRouteItems = {}; var rItems = r.items || [];
      for (var j = 0; j < rItems.length; j++) {
        var it = rItems[j];
        if (!selectedRouteItems[it.shopId]) selectedRouteItems[it.shopId] = [];
        selectedRouteItems[it.shopId].push(it.product);
      }
      document.getElementById('routeFormTitle').textContent = 'Route Edit Karein';
      renderRouteShopPicker(); window.scrollTo(0, 0);
    }
  }
}
function deleteRoute(id) {
  if (!can('routes')) { showToast('Permission nahi hai', 'error'); return; }
  if (!confirm('Pakka route delete?')) return;
  var newList = [];
  for (var i = 0; i < routes.length; i++) { if (routes[i].id != id) newList.push(routes[i]); else deleteFromFirebase('routes', routes[i].id); }
  routes = newList; renderRoutes(); updateRouteNameField();
  showToast('Route delete ho gaya', 'info');
}
function renderRoutes() {
  var list = document.getElementById('routesList'); if (!list) return;
  updateRouteNameField();
  if (routes.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-route"></i>Abhi koi route nahi bana.</div>'; return; }
  var html = '';
  for (var i = 0; i < routes.length; i++) {
    var r = routes[i]; var stats = getRouteStats(r);
    var breakdownHtml = renderRouteProductBreakdown(stats.productBreakdown);
    html += '<div class="route-card" onclick="openRouteModal(\'' + r.id + '\')">' +
      '<div class="route-card-head"><div class="route-card-name"><i class="fa fa-route"></i> ' + r.name + '</div></div>' +
      '<div class="route-card-stats">' +
        '<span class="route-stat"><i class="fa fa-box"></i> ' + stats.itemCount + ' products</span>' +
        '<span class="route-stat green"><i class="fa fa-weight-hanging"></i> ' + stats.totalQtyText + '</span>' +
      '</div>' +
      (breakdownHtml ? '<div class="route-breakdown">' + breakdownHtml + '</div>' : '') +
      '<div class="route-actions" onclick="event.stopPropagation()">' +
        '<button class="btn small" onclick="editRoute(\'' + r.id + '\')"><i class="fa fa-edit"></i> Edit</button>' +
        '<button class="btn small danger" onclick="deleteRoute(\'' + r.id + '\')"><i class="fa fa-trash"></i></button>' +
      '</div></div>';
  }
  list.innerHTML = html;
}
function getRouteStats(route) {
  var totalKg = 0, totalMaund = 0, itemCount = 0;
  var uniqueShops = {}; var items = route.items || [];
  var productMap = {}, productOrder = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i]; itemCount++; uniqueShops[it.shopId] = true;
    var shopProdKg = 0, shopProdMaund = 0, kgList = [];
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j];
      if (o.shopId != it.shopId) continue;
      if (o.status !== 'Pending' && o.status !== 'Partial') continue;
      for (var k = 0; k < o.items.length; k++) {
        var oi = o.items[k]; if (oi.product !== it.product) continue;
        var remM = (parseInt(oi.maund) || 0) - (parseInt(oi.deliveredMaund) || 0);
        var remK = (parseInt(oi.kg) || 0) - (parseInt(oi.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        shopProdKg += (remM * 40) + remK; shopProdMaund += remM;
        if (remK > 0) kgList.push(remK);
      }
    }
    totalKg += shopProdKg; totalMaund += shopProdMaund;
    if (!productMap[it.product]) { productMap[it.product] = { maund: 0, kgList: [] }; productOrder.push(it.product); }
    productMap[it.product].maund += shopProdMaund;
    for (var x = 0; x < kgList.length; x++) productMap[it.product].kgList.push(kgList[x]);
  }
  var breakdown = [];
  for (var p = 0; p < productOrder.length; p++) { var name = productOrder[p]; var data = productMap[name]; breakdown.push({ product: name, maund: data.maund, kgList: data.kgList }); }
  var pendingShopCount = 0;
  var shopIds = Object.keys(uniqueShops);
  for (var i = 0; i < shopIds.length; i++) { if (shopHasPendingOrderInRange(shopIds[i], dashboardDateRange)) pendingShopCount++; }
  return { totalKg: totalKg, totalMaund: totalMaund, totalQtyText: totalKgText(totalKg), pendingShopCount: pendingShopCount, itemCount: itemCount, productBreakdown: breakdown };
}
function renderRouteProductBreakdown(breakdown) {
  if (!breakdown || breakdown.length === 0) return '';
  var html = '';
  for (var i = 0; i < breakdown.length; i++) {
    var b = breakdown[i]; var parts = [];
    if (b.maund > 0) parts.push(b.maund + ' maund');
    for (var k = 0; k < b.kgList.length; k++) parts.push(b.kgList[k] + ' kg');
    if (parts.length === 0) continue;
    html += '<div class="route-breakdown-line"><span class="rb-name">📦 ' + b.product + '</span><span class="rb-qty">' + parts.join(', ') + '</span></div>';
  }
  return html;
}
function renderDashboardRoutes() {
  var list = document.getElementById('dashboardRoutesList');
  var badge = document.getElementById('routesBadge'); if (!list) return;
  var visibleRoutes = [];
  for (var i = 0; i < routes.length; i++) {
    var stats = getRouteStats(routes[i]);
    if (stats.pendingShopCount > 0) visibleRoutes.push({ route: routes[i], stats: stats });
  }
  if (badge) badge.textContent = visibleRoutes.length;
  if (visibleRoutes.length === 0) {
    if (routes.length === 0) list.innerHTML = '<div class="empty"><i class="fa fa-route"></i>Abhi koi route nahi.</div>';
    else list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Is range mein koi route pending nahi.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < visibleRoutes.length; i++) {
    var r = visibleRoutes[i].route; var stats = visibleRoutes[i].stats;
    var breakdownHtml = renderRouteProductBreakdown(stats.productBreakdown);
    html += '<div class="route-card" onclick="openRouteModal(\'' + r.id + '\')">' +
      '<div class="route-card-head"><div class="route-card-name"><i class="fa fa-route"></i> ' + r.name + '</div><i class="fa fa-chevron-right" style="color:#6366f1;"></i></div>' +
      '<div class="route-card-stats">' +
        '<span class="route-stat"><i class="fa fa-box"></i> ' + stats.itemCount + ' products</span>' +
        '<span class="route-stat"><i class="fa fa-clock"></i> ' + stats.pendingShopCount + ' pending shops</span>' +
        '<span class="route-stat green"><i class="fa fa-weight-hanging"></i> ' + stats.totalQtyText + '</span>' +
      '</div>' +
      (breakdownHtml ? '<div class="route-breakdown">' + breakdownHtml + '</div>' : '') +
    '</div>';
  }
  list.innerHTML = html;
}
function openRouteModal(routeId) {
  var route = null;
  for (var i = 0; i < routes.length; i++) { if (routes[i].id == routeId) route = routes[i]; }
  if (!route) return;
  document.getElementById('routeModalTitle').textContent = route.name;
  var body = document.getElementById('routeModalBody');
  var items = route.items || []; var stats = getRouteStats(route);
  if (items.length === 0) { body.innerHTML = '<div class="empty">Is route mein koi product nahi.</div>'; document.getElementById('routeModal').classList.add('active'); return; }
  var shopGroup = {}, shopOrder = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!shopGroup[it.shopId]) { shopGroup[it.shopId] = []; shopOrder.push(it.shopId); }
    shopGroup[it.shopId].push(it.product);
  }
  var html = ''; var grandTotalKg = 0;
  for (var i = 0; i < shopOrder.length; i++) {
    var sid = shopOrder[i]; var shop = null;
    for (var j = 0; j < shopkeepers.length; j++) { if (shopkeepers[j].id == sid) { shop = shopkeepers[j]; break; } }
    if (!shop) continue;
    var prods = shopGroup[sid]; var shopTotalKg = 0;
    var productMap = {}, productOrder2 = [];
    for (var p = 0; p < prods.length; p++) {
      var pName = prods[p]; var kgs = [], mTot = 0, pAmt = 0;
      for (var j = 0; j < orders.length; j++) {
        var o = orders[j];
        if (o.shopId != sid) continue;
        if (o.status !== 'Pending' && o.status !== 'Partial') continue;
        for (var k = 0; k < o.items.length; k++) {
          var oi = o.items[k]; if (oi.product !== pName) continue;
          var remM = (parseInt(oi.maund) || 0) - (parseInt(oi.deliveredMaund) || 0);
          var remK = (parseInt(oi.kg) || 0) - (parseInt(oi.deliveredKg) || 0);
          if (remM <= 0 && remK <= 0) continue;
          mTot += remM; shopTotalKg += (remM * 40) + remK;
          pAmt += (parseInt(oi.amount) || 0);
          if (remK > 0) kgs.push(remK);
        }
      }
      if (!productMap[pName]) { productMap[pName] = { maund: 0, kgList: [], amount: 0 }; productOrder2.push(pName); }
      productMap[pName].maund += mTot;
      productMap[pName].amount += pAmt;
      for (var x = 0; x < kgs.length; x++) productMap[pName].kgList.push(kgs[x]);
    }
    if (productOrder2.length === 0) continue;
    grandTotalKg += shopTotalKg;
    var itemsHtml = '';
    for (var p = 0; p < productOrder2.length; p++) {
      var pName = productOrder2[p]; var pdata = productMap[pName]; var qtyParts = [];
      if (pdata.maund > 0) qtyParts.push(pdata.maund + ' maund');
      for (var q = 0; q < pdata.kgList.length; q++) qtyParts.push(pdata.kgList[q] + ' kg');
      var qtyStr = qtyParts.join(', ') || '0 kg';
      var amtTag = pdata.amount > 0 ? '<span class="rp-qty" style="background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;border-color:#fcd34d;">' + formatRs(pdata.amount) + '</span>' : '';
      itemsHtml += '<div class="route-product-line"><span class="rp-name">📦 ' + pName + '</span><span class="rp-qty">' + qtyStr + '</span>' + amtTag + '</div>';
    }
    var deliverBtn = can('deliver') ? '<button class="btn small success route-shop-deliver-btn" onclick="openDeliverConfirmModal(\'' + route.id + '\', \'' + sid + '\')"><i class="fa fa-check"></i> Delivered</button>' : '';
    var farziTag = (shop.category === 'farzi') ? ' <span class="farzi-badge">FARZI</span>' : '';
    html += '<div class="route-detail-shop' + (shop.category === 'farzi' ? ' farzi-card' : '') + '">' +
      '<div class="route-detail-shop-head">' +
        '<div style="flex:1;"><h4><i class="fa fa-store"></i> ' + shop.name + farziTag + '</h4>' +
        '<p style="font-size:13px;color:#64748b;margin-top:3px;"><i class="fa fa-phone"></i> ' + shop.mobile + '</p></div>' +
        '<span class="qty-pill">' + totalKgText(shopTotalKg) + '</span>' + deliverBtn +
      '</div>' +
      '<div class="route-detail-items">' + itemsHtml + '</div>' +
    '</div>';
  }
  if (html === '') { body.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Is route ke sab orders deliver ho gaye!</div>'; document.getElementById('routeModal').classList.add('active'); return; }
  var breakdownHtml = renderRouteProductBreakdown(stats.productBreakdown);
  html += '<div class="load-summary route-total-summary" style="margin-top:18px;margin-bottom:0;">' +
    '<div style="width:100%;"><p>Route Ka Total Load</p>' +
    '<div class="big-num" style="margin-bottom:12px;">' + totalKgText(grandTotalKg) + '</div>' +
    (breakdownHtml ? '<div class="route-total-breakdown">' + breakdownHtml + '</div>' : '') + '</div>' +
    '<div style="text-align:right;border-top:1px solid rgba(255,255,255,0.2);padding-top:12px;width:100%;margin-top:12px;">' +
      '<p>Shopkeepers</p><div class="big-num">' + shopOrder.length + '</div></div>' +
  '</div>';
  body.innerHTML = html;
  document.getElementById('routeModal').classList.add('active');
}
function closeRouteModal() { document.getElementById('routeModal').classList.remove('active'); }
function openDeliverConfirmModal(routeId, shopId) {
  if (!can('deliver')) { showToast('Permission nahi hai', 'error'); return; }
  var route = null;
  for (var i = 0; i < routes.length; i++) { if (routes[i].id == routeId) { route = routes[i]; break; } }
  if (!route) return;
  var shop = getShopById(shopId); if (!shop) return;
  var routeItems = route.items || []; var shopProductsInRoute = [];
  for (var i = 0; i < routeItems.length; i++) { if (routeItems[i].shopId == shopId) shopProductsInRoute.push(routeItems[i].product); }
  if (shopProductsInRoute.length === 0) { showToast('Koi product nahi.', 'warning'); return; }
  var body = document.getElementById('deliverConfirmBody');
  var nameEl = document.getElementById('deliverConfirmShopName');
  var farziTag = (shop.category === 'farzi') ? ' 🔵 FARZI' : '';
  if (nameEl) nameEl.textContent = shop.name + farziTag + ' ke ye products deliver karein?';
  var html = '';
  for (var p = 0; p < shopProductsInRoute.length; p++) {
    var pName = shopProductsInRoute[p]; var mTot = 0, kgList = [];
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j];
      if (o.shopId != shopId) continue;
      if (o.status !== 'Pending' && o.status !== 'Partial') continue;
      for (var k = 0; k < o.items.length; k++) {
        var oi = o.items[k]; if (oi.product !== pName) continue;
        var remM = (parseInt(oi.maund) || 0) - (parseInt(oi.deliveredMaund) || 0);
        var remK = (parseInt(oi.kg) || 0) - (parseInt(oi.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        mTot += remM; if (remK > 0) kgList.push(remK);
      }
    }
    var qtyParts = [];
    if (mTot > 0) qtyParts.push(mTot + ' maund');
    for (var q = 0; q < kgList.length; q++) qtyParts.push(kgList[q] + ' kg');
    var qtyStr = qtyParts.join(', ') || '0 kg';
    html += '<div class="confirm-item"><span class="ci-name">📦 ' + pName + '</span><span class="ci-qty">' + qtyStr + '</span></div>';
  }
  if (body) body.innerHTML = html;
  pendingDeliverRouteId = routeId; pendingDeliverShopId = shopId;
  document.getElementById('deliverConfirmModal').classList.add('active');
}
function closeDeliverConfirmModal() {
  document.getElementById('deliverConfirmModal').classList.remove('active');
  pendingDeliverRouteId = null; pendingDeliverShopId = null;
}
function confirmDeliverConfirmModal() {
  var routeId = pendingDeliverRouteId; var shopId = pendingDeliverShopId;
  closeDeliverConfirmModal();
  if (!routeId || !shopId) return;
  deliverRouteShop(routeId, shopId);
}
function deliverRouteShop(routeId, shopId) {
  if (!can('deliver')) { showToast('Permission nahi hai', 'error'); return; }
  var route = null;
  for (var i = 0; i < routes.length; i++) { if (routes[i].id == routeId) { route = routes[i]; break; } }
  if (!route) return;
  var shop = getShopById(shopId); if (!shop) return;
  var routeItems = route.items || []; var shopProductsInRoute = [];
  for (var i = 0; i < routeItems.length; i++) { if (routeItems[i].shopId == shopId) shopProductsInRoute.push(routeItems[i].product); }
  if (shopProductsInRoute.length === 0) { showToast('Koi product nahi.', 'warning'); return; }
  var deliveredItemsForWa = [];
  for (var p = 0; p < shopProductsInRoute.length; p++) {
    var pName = shopProductsInRoute[p]; var mTot = 0, kgList = [];
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j];
      if (o.shopId != shopId) continue;
      if (o.status !== 'Pending' && o.status !== 'Partial') continue;
      for (var k = 0; k < o.items.length; k++) {
        var oi = o.items[k]; if (oi.product !== pName) continue;
        var remM = (parseInt(oi.maund) || 0) - (parseInt(oi.deliveredMaund) || 0);
        var remK = (parseInt(oi.kg) || 0) - (parseInt(oi.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        mTot += remM; if (remK > 0) kgList.push(remK);
      }
    }
    deliveredItemsForWa.push({ product: pName, maund: mTot, kg: 0, kgList: kgList.slice() });
  }
  var isFarzi = shop.category === 'farzi';
  var pendingOrderIds = [];
  for (var p = 0; p < shopProductsInRoute.length; p++) {
    var pName = shopProductsInRoute[p];
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j];
      if (o.shopId != shopId) continue;
      if (o.status !== 'Pending' && o.status !== 'Partial') continue;
      for (var k = 0; k < o.items.length; k++) {
        var oi = o.items[k]; if (oi.product !== pName) continue;
        oi.deliveredMaund = parseInt(oi.maund) || 0;
        oi.deliveredKg = parseInt(oi.kg) || 0;
      }
      o.status = checkOrderDelivered(o) ? 'Delivered' : 'Partial';
      saveToFirebase('orders', o.id, o);
      addOrderAmountToAccountIfNeeded(o);
      if (isFarzi && o.status === 'Delivered' && pendingOrderIds.indexOf(o.id) === -1) pendingOrderIds.push(o.id);
    }
  }
  cleanupRouteAfterDelivery();
  setTimeout(function() {
    var routeModal = document.getElementById('routeModal');
    if (routeModal && routeModal.classList.contains('active')) openRouteModal(routeId);
    renderDashboardRoutes(); renderDashboard();
    showToast('✅ ' + shop.name + ' ke products deliver ho gaye!', 'success');
    if (isFarzi && pendingOrderIds.length > 0) { openFarziDeliverModal(pendingOrderIds[0]); }
    else if (shop && shop.mobile && deliveredItemsForWa.length > 0) { openWhatsappMultiDeliveredShareModal(deliveredItemsForWa, shop); }
  }, 300);
}
function prepareOrderForm() {
  selectedShopIdForOrder = null; selectedProductForOrder = null; selectedEditIndex = -1;
  currentOrderItems = []; isSavingOrder = false;
  showNewOrderStep(1);
  var notesEl = document.getElementById('orderNotes'); if (notesEl) notesEl.value = '';
  var saveBtn = document.getElementById('saveOrderBtn'); if (saveBtn) enableButton(saveBtn);
}
function showNewOrderStep(step) {
  var step1 = document.getElementById('shopPickerStep');
  var step2 = document.getElementById('productPickerStep');
  var step3 = document.getElementById('quantityStep');
  var heading = document.getElementById('newOrderHeading');
  var sub = document.getElementById('newOrderSub');
  step1.style.display = 'none'; step2.style.display = 'none'; step3.style.display = 'none';
  if (step === 1) { step1.style.display = 'block'; if (heading) heading.textContent = 'Naya Order'; if (sub) sub.textContent = 'Pehle shopkeeper chunein'; renderShopPickerGrid(); }
  else if (step === 2) { step2.style.display = 'block'; if (heading) heading.textContent = 'Products Chunein'; if (sub) sub.textContent = 'Product pe tap karke quantity add karein'; renderProductPickerGrid(); renderAddedProducts(); }
  else if (step === 3) { step3.style.display = 'block'; if (heading) heading.textContent = 'Quantity Daalein'; if (sub) sub.textContent = 'Maund aur Kg alag alag likhein'; }
  window.scrollTo(0, 0);
}
function renderShopPickerGrid() {
  var grid = document.getElementById('shopPickerGrid'); if (!grid) return;
  if (shopkeepers.length === 0) { grid.innerHTML = '<div class="empty" style="grid-column: 1 / -1;"><i class="fa fa-users"></i>Pehle shopkeeper add karein.</div>'; return; }
  var html = '';
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    var farziTag = (s.category === 'farzi') ? ' <span class="farzi-badge">FARZI</span>' : '';
    var cardClass = (s.category === 'farzi') ? 'shop-picker-card farzi-card' : 'shop-picker-card';
    var iconClass = (s.category === 'farzi') ? 'sp-icon farzi-icon' : 'sp-icon';
    html += '<div class="' + cardClass + '" onclick="selectShopkeeperForOrder(\'' + s.id + '\')">' +
      '<div class="' + iconClass + '"><i class="fa fa-store"></i></div>' +
      '<div class="sp-name">' + s.name + farziTag + '</div>' +
      '<div class="sp-mobile"><i class="fa fa-phone"></i> ' + s.mobile + '</div>' +
      (s.address ? '<div class="sp-address"><i class="fa fa-map-marker-alt"></i> ' + s.address + '</div>' : '') +
      '</div>';
  }
  grid.innerHTML = html;
}
function selectShopkeeperForOrder(shopId) {
  selectedShopIdForOrder = shopId; currentOrderItems = [];
  var shop = null;
  for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopId) shop = shopkeepers[i]; }
  if (!shop) return;
  document.getElementById('selectedShopName').textContent = shop.name;
  document.getElementById('selectedShopMobile').innerHTML = '<i class="fa fa-phone"></i> ' + shop.mobile;
  showNewOrderStep(2); history.pushState({ page: 'neworder', step: 2 }, '');
}
function changeShopkeeper() { selectedShopIdForOrder = null; currentOrderItems = []; showNewOrderStep(1); history.pushState({ page: 'neworder', step: 1 }, ''); }
function renderProductPickerGrid() {
  var grid = document.getElementById('productPickerGrid'); if (!grid) return;
  if (products.length === 0) { grid.innerHTML = '<div class="empty" style="grid-column: 1 / -1;"><i class="fa fa-box"></i>Koi product nahi.</div>'; return; }
  var html = '';
  for (var i = 0; i < products.length; i++) {
    var p = products[i]; var count = 0;
    for (var j = 0; j < currentOrderItems.length; j++) { if (currentOrderItems[j].product === p) count++; }
    var added = count > 0;
    var badgeHtml = added ? '<span class="pp-count-badge">' + count + '</span>' : '';
    html += '<div class="product-picker-card' + (added ? ' added' : '') + '" onclick="selectProductForOrder(\'' + p.replace(/'/g, "\\'") + '\')">' +
      badgeHtml + '<div class="pp-icon"><i class="fa fa-box"></i></div><div class="pp-name">' + p + '</div></div>';
  }
  grid.innerHTML = html;
}
function selectProductForOrder(productName) {
  var existingIndexes = [];
  for (var i = 0; i < currentOrderItems.length; i++) { if (currentOrderItems[i].product === productName) existingIndexes.push(i); }
  if (existingIndexes.length > 0) {
    var choice = confirm(productName + ' pehle se ' + existingIndexes.length + ' baar add hai.\n\nOK = NAYA ADD\nCancel = EDIT');
    if (choice) {
      selectedProductForOrder = productName; selectedEditIndex = -1;
      document.getElementById('qtyProductName').textContent = productName;
      document.getElementById('qtyMaund').value = ''; document.getElementById('qtyKg').value = '';
      updateQtyPreview(); showNewOrderStep(3); history.pushState({ page: 'neworder', step: 3 }, '');
    } else {
      if (existingIndexes.length === 1) editAddedProduct(existingIndexes[0]);
      else alert('Is product ki ' + existingIndexes.length + ' entries hain.');
    }
  } else {
    selectedProductForOrder = productName; selectedEditIndex = -1;
    document.getElementById('qtyProductName').textContent = productName;
    document.getElementById('qtyMaund').value = ''; document.getElementById('qtyKg').value = '';
    updateQtyPreview(); showNewOrderStep(3); history.pushState({ page: 'neworder', step: 3 }, '');
  }
}
function updateQtyPreview() {
  var m = parseInt(document.getElementById('qtyMaund').value) || 0;
  var k = parseInt(document.getElementById('qtyKg').value) || 0;
  document.getElementById('qtyPreviewText').textContent = totalKgText((m * 40) + k);
}
function cancelQty() { selectedProductForOrder = null; selectedEditIndex = -1; showNewOrderStep(2); history.pushState({ page: 'neworder', step: 2 }, ''); }
function confirmQtyAdd() {
  var m = parseInt(document.getElementById('qtyMaund').value) || 0;
  var k = parseInt(document.getElementById('qtyKg').value) || 0;
  if (m === 0 && k === 0) { showToast('Kam az kam maund ya kg daalein!', 'warning'); return; }
  if (selectedEditIndex >= 0 && selectedEditIndex < currentOrderItems.length) {
    currentOrderItems[selectedEditIndex].maund = m; currentOrderItems[selectedEditIndex].kg = k;
  } else { currentOrderItems.push({ product: selectedProductForOrder, maund: m, kg: k }); }
  selectedProductForOrder = null; selectedEditIndex = -1;
  showNewOrderStep(2); history.pushState({ page: 'neworder', step: 2 }, '');
}
function renderAddedProducts() {
  var box = document.getElementById('addedProductsBox');
  var list = document.getElementById('addedProductsList');
  var count = document.getElementById('addedProductsCount');
  if (!box || !list) return;
  if (currentOrderItems.length === 0) { box.style.display = 'none'; return; }
  box.style.display = 'block'; if (count) count.textContent = currentOrderItems.length;
  var html = '';
  for (var i = 0; i < currentOrderItems.length; i++) {
    var it = currentOrderItems[i];
    html += '<div class="added-product-row">' +
      '<div class="ap-name"><i class="fa fa-check-circle"></i> ' + it.product + '</div>' +
      '<div class="ap-qty">' + qtyText(it.maund, it.kg) + '</div>' +
      '<div class="ap-actions">' +
        '<button class="btn small" onclick="editAddedProduct(' + i + ')"><i class="fa fa-edit"></i></button>' +
        '<button class="btn small danger" onclick="removeAddedProduct(' + i + ')"><i class="fa fa-trash"></i></button>' +
      '</div></div>';
  }
  list.innerHTML = html;
}
function editAddedProduct(idx) {
  var it = currentOrderItems[idx];
  selectedProductForOrder = it.product; selectedEditIndex = idx;
  document.getElementById('qtyProductName').textContent = it.product;
  document.getElementById('qtyMaund').value = it.maund > 0 ? it.maund : '';
  document.getElementById('qtyKg').value = it.kg > 0 ? it.kg : '';
  updateQtyPreview(); showNewOrderStep(3); history.pushState({ page: 'neworder', step: 3 }, '');
}
function removeAddedProduct(idx) { currentOrderItems.splice(idx, 1); renderAddedProducts(); renderProductPickerGrid(); }
function saveMultiOrder(btn) {
  if (!can('newOrder')) { showToast('Permission nahi hai', 'error'); return; }
  if (isSavingOrder) { showToast('Order save ho raha hai...', 'warning'); return; }
  if (!selectedShopIdForOrder) { showToast('Pehle shopkeeper chunein!', 'warning'); return; }
  if (currentOrderItems.length === 0) { showToast('Kam az kam ek product add karein!', 'warning'); return; }
  if (!firebaseReady) { showToast('Firebase load nahi hua', 'error'); return; }
  if (btn) disableButton(btn, 'Opening...');
  setTimeout(function() { if (btn) enableButton(btn); openAmountModal(); }, 200);
}
function renderOrdersPage() {
  var statusFilter = document.getElementById('ordersStatus').value;
  var filtered = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (!isOrderInRange(o.date, ordersDateRange)) continue;
    if (statusFilter === 'Pending' && o.status === 'Delivered') continue;
    filtered.push(o);
  }
  var list = document.getElementById('ordersList');
  var summary = document.getElementById('ordersSummary');
  if (filtered.length === 0) {
    summary.innerHTML = '<div><p>' + formatDate(ordersDateRange.from) + ' - ' + formatDate(ordersDateRange.to) + '</p><div class="big-num">0 kg</div></div>';
    list.innerHTML = '<div class="empty"><i class="fa fa-truck"></i>Is range mein koi order nahi.</div>';
    return;
  }
  var totalKg = 0; var totalAmount = 0;
  for (var i = 0; i < filtered.length; i++) {
    var o = filtered[i];
    totalAmount += parseInt(o.totalAmount) || 0;
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      totalKg += (remM * 40) + remK;
    }
  }
  summary.innerHTML = '<div><p>' + formatDate(ordersDateRange.from) + ' - ' + formatDate(ordersDateRange.to) + '<br>Baqi Load</p><div class="big-num">' + totalKgText(totalKg) + '</div></div>' +
    (totalAmount > 0 ? '<div><p>Total Amount</p><div class="big-num">' + formatRs(totalAmount) + '</div></div>' : '');
  var grouped = {};
  for (var i = 0; i < filtered.length; i++) {
    var sid = filtered[i].shopId;
    if (!grouped[sid]) grouped[sid] = [];
    grouped[sid].push(filtered[i]);
  }
  var html = ''; var keys = Object.keys(grouped);
  for (var k = 0; k < keys.length; k++) {
    var shopId = keys[k]; var shopName = 'Unknown', shopAddress = '—', shopMobile = ''; var shopObj = null;
    for (var i = 0; i < shopkeepers.length; i++) {
      if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; shopAddress = shopkeepers[i].address || '—'; shopMobile = shopkeepers[i].mobile; shopObj = shopkeepers[i]; }
    }
    var isFarzi = shopObj && shopObj.category === 'farzi';
    var farziTag = isFarzi ? ' <span class="farzi-badge">FARZI</span>' : '';
    var sOrders = grouped[shopId]; var shopKg = 0;
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        shopKg += (remM * 40) + remK;
      }
    }
    var ordersHtml = '';
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i]; var orderItemsHtml = ''; var orderTotalKg = 0; var hasPendingItems = false;
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        hasPendingItems = true;
        orderTotalKg += (remM * 40) + remK;
        var deliveredText = '';
        if (it.deliveredMaund > 0 || it.deliveredKg > 0) deliveredText = '<div class="p-delivered">✓ ' + qtyText(it.deliveredMaund, it.deliveredKg) + ' deliver</div>';
        var amountText = '<span class="amt-tag">' + formatRs(it.amount || 0) + '</span>';
        var action = can('deliver') ? '<button class="btn small success" onclick="openDeliverModal(\'' + o.id + '\', \'' + it.product.replace(/'/g, "\\'") + '\')"><i class="fa fa-check"></i> Delivered</button>' : '';
        orderItemsHtml += '<div class="product-line"><div class="product-line-info">' +
          '<span class="p-name">📦 ' + it.product + '</span>' + amountText +
          '<span class="p-qty">' + qtyText(remM, remK) + '</span>' + deliveredText +
          '</div>' + action + '</div>';
      }
      var offlineClass = o._offlinePending ? ' offline-pending' : '';
      var editCancelHtml = '';
      if (hasPendingItems && can('newOrder')) {
        editCancelHtml = '<div class="order-actions">' +
          '<button class="btn btn-edit-order" onclick="openEditOrderModal(\'' + o.id + '\')"><i class="fa fa-edit"></i> Edit</button>' +
          '<button class="btn btn-cancel-order" onclick="openCancelOrderModal(\'' + o.id + '\')"><i class="fa fa-times"></i> Cancel</button>' +
        '</div>';
      }
      ordersHtml += '<div class="shop-group' + offlineClass + (isFarzi ? ' farzi-card' : '') + '" style="margin-top:10px;">' +
        '<div class="shop-group-head">' +
          '<div class="shop-group-head-with-user">' +
            getUserBadgeHtml(o.createdBy, 'small') +
            '<div class="shop-group-head-info">' +
              '<h4><i class="fa fa-receipt"></i> Order #' + (i + 1) + '</h4>' +
              '<p style="font-size:12px;color:#64748b;"><i class="fa fa-calendar"></i> ' + formatDate(o.date) + ' • ' + getOrderDateTimeText(o) + '</p>' +
              '<p style="font-size:12px;color:#64748b;">👤 ' + (function() { var u = findUserByUsername(o.createdBy); return u ? getUserDisplayName(u) : (o.createdBy || 'Unknown'); })() + '</p>' +
            '</div></div>' +
          '<span class="shop-group-total">' + totalKgText(orderTotalKg) + ' • ' + formatRs(o.totalAmount || 0) + '</span>' +
        '</div>' + orderItemsHtml + editCancelHtml + '</div>';
    }
    var shopTotalAmt = 0;
    for (var i = 0; i < sOrders.length; i++) shopTotalAmt += parseInt(sOrders[i].totalAmount) || 0;
    html += '<div class="box" style="margin-bottom:14px;">' +
      '<div class="box-head" onclick="openOrderDetailModal(\'' + shopId + '\')" style="cursor:pointer;">' +
        '<div><h2 style="font-size:16px;"><i class="fa fa-store"></i> ' + shopName + farziTag + '</h2>' +
        '<p style="font-size:13px;color:#64748b;"><i class="fa fa-map-marker-alt"></i> ' + shopAddress + ' • <i class="fa fa-phone"></i> ' + shopMobile + '</p></div>' +
        '<span class="pill">' + totalKgText(shopKg) + ' • ' + formatRs(shopTotalAmt) + '</span>' +
      '</div>' + ordersHtml + '</div>';
  }
  list.innerHTML = html;
}
function openDeliverModal(orderId, product) {
  if (!can('deliver')) { showToast('Permission nahi hai', 'error'); return; }
  currentDeliverOrderId = orderId; currentDeliverProduct = product;
  currentCombinedProduct = null; currentCombinedOrderIds = [];
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) order = orders[i]; }
  if (!order) return;
  var shopName = '';
  for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == order.shopId) shopName = shopkeepers[i].name; }
  document.getElementById('deliverTitle').textContent = product + ' - ' + shopName;
  var pending = getPendingItemsForProduct(order, product);
  var body = document.getElementById('deliverBody');
  var html = '';
  for (var i = 0; i < pending.length; i++) {
    var p = pending[i];
    html += '<div class="deliver-row"><div class="deliver-row-head">Baqi: ' + qtyText(p.maund, p.kg) + '</div>' +
      '<div class="deliver-row-sub">Kitna deliver?</div>' +
      '<div class="deliver-qty-row">' +
      '<div class="form-group"><label>Maund</label><input type="number" class="deliver-maund" min="0" max="' + p.maund + '" placeholder="' + p.maund + '" data-idx="' + p.index + '" /></div>' +
      '<div class="form-group"><label>Kg</label><input type="number" class="deliver-kg" min="0" max="' + p.kg + '" placeholder="' + p.kg + '" data-idx="' + p.index + '" /></div>' +
      '</div></div>';
  }
  body.innerHTML = html;
  document.getElementById('deliverModal').classList.add('active');
}
function closeDeliverModal() {
  document.getElementById('deliverModal').classList.remove('active');
  currentDeliverOrderId = null; currentDeliverProduct = null;
  currentCombinedProduct = null; currentCombinedOrderIds = [];
}
function confirmDelivery() {
  if (!can('deliver')) return;
  if (!currentDeliverOrderId || !currentDeliverProduct) return;
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentDeliverOrderId) order = orders[i]; }
  if (!order) return;
  var maundInputs = document.querySelectorAll('.deliver-maund');
  var kgInputs = document.querySelectorAll('.deliver-kg');
  for (var i = 0; i < maundInputs.length; i++) {
    var idx = parseInt(maundInputs[i].getAttribute('data-idx'));
    var dm = parseInt(maundInputs[i].value); var dk = parseInt(kgInputs[i].value);
    var it = order.items[idx];
    var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
    var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
    if (isNaN(dm)) dm = remM; if (isNaN(dk)) dk = remK;
    if (dm > remM) dm = remM; if (dk > remK) dk = remK;
    if (dm < 0) dm = 0; if (dk < 0) dk = 0;
    it.deliveredMaund = (parseInt(it.deliveredMaund) || 0) + dm;
    it.deliveredKg = (parseInt(it.deliveredKg) || 0) + dk;
  }
  order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
  saveToFirebase('orders', order.id, order);
  addOrderAmountToAccountIfNeeded(order);
  closeDeliverModal(); cleanupRouteAfterDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  var shop = getShopById(order.shopId);
  if (shop && shop.category === 'farzi' && order.status === 'Delivered') { setTimeout(function() { openFarziDeliverModal(order.id); }, 400); return; }
  showToast('✅ Delivered mark ho gaya!', 'success');
  if (shop && shop.mobile) openWhatsappDeliveredShareModal(order, shop);
}
function markAllDelivered() {
  if (!can('deliver')) return;
  if (!currentDeliverOrderId || !currentDeliverProduct) return;
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentDeliverOrderId) order = orders[i]; }
  if (!order) return;
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    if (it.product === currentDeliverProduct) { it.deliveredMaund = parseInt(it.maund) || 0; it.deliveredKg = parseInt(it.kg) || 0; }
  }
  order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
  saveToFirebase('orders', order.id, order);
  addOrderAmountToAccountIfNeeded(order);
  closeDeliverModal(); cleanupRouteAfterDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  var shop = getShopById(order.shopId);
  if (shop && shop.category === 'farzi' && order.status === 'Delivered') { setTimeout(function() { openFarziDeliverModal(order.id); }, 400); return; }
  showToast('✅ Poora deliver mark ho gaya!', 'success');
  if (shop && shop.mobile) openWhatsappDeliveredShareModal(order, shop);
}
function confirmDeliverySmart(btn) { if (btn) disableButton(btn, 'Delivering...'); setTimeout(function() { if (currentCombinedProduct) confirmCombinedDelivery(); else confirmDelivery(); if (btn) enableButton(btn); }, 100); }
function markAllDeliveredSmart(btn) { if (btn) disableButton(btn, 'Delivering...'); setTimeout(function() { if (currentCombinedProduct) markAllCombinedDelivered(); else markAllDelivered(); if (btn) enableButton(btn); }, 100); }
function openCombinedDeliverModal(productName, orderIds) {
  if (!can('deliver')) { showToast('Permission nahi hai', 'error'); return; }
  currentCombinedProduct = productName; currentCombinedOrderIds = orderIds || [];
  var totalM = 0, totalK = 0;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    var oid = currentCombinedOrderIds[i];
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j]; if (o.id != oid) continue;
      for (var k = 0; k < o.items.length; k++) {
        var it = o.items[k]; if (it.product !== productName) continue;
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        totalM += remM; totalK += remK;
      }
    }
  }
  var shopName = ''; var shopIdForName = null;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    for (var j = 0; j < orders.length; j++) { if (orders[j].id == currentCombinedOrderIds[i]) { shopIdForName = orders[j].shopId; break; } }
    if (shopIdForName) break;
  }
  for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopIdForName) shopName = shopkeepers[i].name; }
  document.getElementById('deliverTitle').textContent = productName + ' - ' + shopName;
  var body = document.getElementById('deliverBody');
  var html = '<div class="deliver-row"><div class="deliver-row-head">Baqi: ' + qtyText(totalM, totalK) + '</div>' +
    '<div class="deliver-row-sub">Kitna deliver?</div>' +
    '<div class="deliver-qty-row">' +
      '<div class="form-group"><label>Maund</label><input type="number" class="combined-maund" min="0" max="' + totalM + '" placeholder="' + totalM + '" /></div>' +
      '<div class="form-group"><label>Kg</label><input type="number" class="combined-kg" min="0" max="' + totalK + '" placeholder="' + totalK + '" /></div>' +
    '</div></div>';
  body.innerHTML = html;
  document.getElementById('deliverModal').classList.add('active');
}
function confirmCombinedDelivery() {
  if (!can('deliver')) return;
  if (!currentCombinedProduct) return;
  var mInput = document.querySelector('.combined-maund'); var kInput = document.querySelector('.combined-kg');
  var dm = mInput ? parseInt(mInput.value) : NaN; var dk = kInput ? parseInt(kInput.value) : NaN;
  var totalM = 0, totalK = 0;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    var oid = currentCombinedOrderIds[i];
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j]; if (o.id != oid) continue;
      for (var k = 0; k < o.items.length; k++) {
        var it = o.items[k]; if (it.product !== currentCombinedProduct) continue;
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        totalM += remM; totalK += remK;
      }
    }
  }
  if (isNaN(dm)) dm = totalM; if (isNaN(dk)) dk = totalK;
  if (dm > totalM) dm = totalM; if (dk > totalK) dk = totalK;
  if (dm < 0) dm = 0; if (dk < 0) dk = 0;
  var remainingM = dm, remainingK = dk;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    if (remainingM <= 0 && remainingK <= 0) break;
    var oid = currentCombinedOrderIds[i]; var order = null;
    for (var j = 0; j < orders.length; j++) { if (orders[j].id == oid) { order = orders[j]; break; } }
    if (!order) continue;
    for (var k = 0; k < order.items.length; k++) {
      if (remainingM <= 0 && remainingK <= 0) break;
      var it = order.items[k]; if (it.product !== currentCombinedProduct) continue;
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      if (remM <= 0 && remK <= 0) continue;
      var giveM = Math.min(remM, remainingM); var giveK = Math.min(remK, remainingK);
      it.deliveredMaund = (parseInt(it.deliveredMaund) || 0) + giveM;
      it.deliveredKg = (parseInt(it.deliveredKg) || 0) + giveK;
      remainingM -= giveM; remainingK -= giveK;
    }
    order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
    saveToFirebase('orders', order.id, order);
    addOrderAmountToAccountIfNeeded(order);
  }
  var waShop = null, waOrder = null;
  if (currentCombinedOrderIds.length > 0) {
    for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentCombinedOrderIds[0]) { waOrder = orders[i]; break; } }
    if (waOrder) waShop = getShopById(waOrder.shopId);
  }
  closeDeliverModal(); cleanupRouteAfterDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  if (waShop && waShop.category === 'farzi' && waOrder && waOrder.status === 'Delivered') { setTimeout(function() { openFarziDeliverModal(waOrder.id); }, 400); return; }
  showToast('✅ Delivered mark ho gaya!', 'success');
  if (waShop && waShop.mobile && waOrder) openWhatsappDeliveredShareModal(waOrder, waShop);
}
function markAllCombinedDelivered() {
  if (!can('deliver')) return;
  if (!currentCombinedProduct) return;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    var oid = currentCombinedOrderIds[i]; var order = null;
    for (var j = 0; j < orders.length; j++) { if (orders[j].id == oid) { order = orders[j]; break; } }
    if (!order) continue;
    for (var k = 0; k < order.items.length; k++) {
      var it = order.items[k]; if (it.product !== currentCombinedProduct) continue;
      it.deliveredMaund = parseInt(it.maund) || 0; it.deliveredKg = parseInt(it.kg) || 0;
    }
    order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
    saveToFirebase('orders', order.id, order);
    addOrderAmountToAccountIfNeeded(order);
  }
  var waShop = null, waOrder = null;
  if (currentCombinedOrderIds.length > 0) {
    for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentCombinedOrderIds[0]) { waOrder = orders[i]; break; } }
    if (waOrder) waShop = getShopById(waOrder.shopId);
  }
  closeDeliverModal(); cleanupRouteAfterDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  if (waShop && waShop.category === 'farzi' && waOrder && waOrder.status === 'Delivered') { setTimeout(function() { openFarziDeliverModal(waOrder.id); }, 400); return; }
  showToast('✅ Poora deliver mark ho gaya!', 'success');
  if (waShop && waShop.mobile && waOrder) openWhatsappDeliveredShareModal(waOrder, waShop);
}
function openEditOrderModal(orderId) {
  if (!can('newOrder')) { showToast('Permission nahi hai', 'error'); return; }
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) return;
  if (order.status === 'Delivered') { showToast('Delivered order edit nahi ho sakta', 'warning'); return; }
  currentEditingOrder = order; currentEditOrderItems = [];
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    currentEditOrderItems.push({ product: it.product, maund: parseInt(it.maund) || 0, kg: parseInt(it.kg) || 0, amount: parseInt(it.amount) || 0 });
  }
  var shop = getShopById(order.shopId);
  var nameEl = document.getElementById('editOrderShopName');
  if (nameEl) nameEl.textContent = shop ? shop.name : 'Unknown';
  var dateEl = document.getElementById('editOrderDateLabel');
  if (dateEl) dateEl.textContent = '📅 ' + formatDate(order.date) + ' • ' + getOrderDateTimeText(order);
  renderEditOrderItemsList();
  document.getElementById('editOrderModal').classList.add('active');
}
function renderEditOrderItemsList() {
  var list = document.getElementById('editOrderItemsList'); if (!list) return;
  if (currentEditOrderItems.length === 0) { list.innerHTML = '<div class="empty" style="padding:20px;"><i class="fa fa-box"></i>Koi item nahi. Naya item add karein.</div>'; return; }
  var html = '';
  for (var i = 0; i < currentEditOrderItems.length; i++) {
    var it = currentEditOrderItems[i];
    var amtText = it.amount ? ' <span class="amt-tag">' + formatRs(it.amount) + '</span>' : '';
    html += '<div class="edit-item-row">' +
      '<div class="eir-info"><span class="eir-name">📦 ' + it.product + '</span>' + amtText + '<span class="eir-qty">' + qtyText(it.maund, it.kg) + '</span></div>' +
      '<div class="eir-actions">' +
        '<button class="btn-edit" onclick="openEditItemModal(' + i + ')"><i class="fa fa-edit"></i></button>' +
        '<button class="btn-del" onclick="removeEditOrderItem(' + i + ')"><i class="fa fa-trash"></i></button>' +
      '</div></div>';
  }
  list.innerHTML = html;
}
function removeEditOrderItem(idx) {
  if (idx < 0 || idx >= currentEditOrderItems.length) return;
  if (!confirm('Yeh item hata dein?')) return;
  currentEditOrderItems.splice(idx, 1); renderEditOrderItemsList();
}
function openAddNewItemToEdit() {
  currentEditItemIndex = -1;
  var select = document.getElementById('editItemProduct'); var html = '';
  for (var i = 0; i < products.length; i++) html += '<option value="' + products[i].replace(/"/g, '&quot;') + '">' + products[i] + '</option>';
  select.innerHTML = html;
  document.getElementById('editItemMaund').value = ''; document.getElementById('editItemKg').value = '';
  document.getElementById('editItemModal').classList.add('active');
}
function openEditItemModal(idx) {
  if (idx < 0 || idx >= currentEditOrderItems.length) return;
  currentEditItemIndex = idx;
  var it = currentEditOrderItems[idx];
  var select = document.getElementById('editItemProduct'); var html = '';
  for (var i = 0; i < products.length; i++) {
    var sel = (products[i] === it.product) ? ' selected' : '';
    html += '<option value="' + products[i].replace(/"/g, '&quot;') + '"' + sel + '>' + products[i] + '</option>';
  }
  select.innerHTML = html;
  document.getElementById('editItemMaund').value = it.maund > 0 ? it.maund : '';
  document.getElementById('editItemKg').value = it.kg > 0 ? it.kg : '';
  document.getElementById('editItemModal').classList.add('active');
}
function closeEditItemModal() { document.getElementById('editItemModal').classList.remove('active'); currentEditItemIndex = -1; }
function confirmEditItem() {
  var product = document.getElementById('editItemProduct').value;
  var maund = parseInt(document.getElementById('editItemMaund').value) || 0;
  var kg = parseInt(document.getElementById('editItemKg').value) || 0;
  if (!product) { showToast('Product select karein', 'warning'); return; }
  if (maund === 0 && kg === 0) { showToast('Kam az kam maund ya kg daalein', 'warning'); return; }
  if (currentEditItemIndex === -1) currentEditOrderItems.push({ product: product, maund: maund, kg: kg, amount: 0 });
  else {
    currentEditOrderItems[currentEditItemIndex].product = product;
    currentEditOrderItems[currentEditItemIndex].maund = maund;
    currentEditOrderItems[currentEditItemIndex].kg = kg;
  }
  closeEditItemModal(); renderEditOrderItemsList();
}
function closeEditOrderModal() {
  document.getElementById('editOrderModal').classList.remove('active');
  currentEditingOrder = null; currentEditOrderItems = []; currentEditItemIndex = -1;
}
function saveEditedOrder(btn) {
  if (!currentEditingOrder) return;
  if (currentEditOrderItems.length === 0) { showToast('Kam az kam ek item rakhein', 'warning'); return; }
  if (btn) disableButton(btn, 'Updating...');
  var oldItems = [];
  for (var i = 0; i < currentEditingOrder.items.length; i++) {
    var it = currentEditingOrder.items[i];
    oldItems.push({ product: it.product, maund: parseInt(it.maund) || 0, kg: parseInt(it.kg) || 0 });
  }
  var newItems = []; var totalKg = 0; var totalAmount = 0;
  for (var i = 0; i < currentEditOrderItems.length; i++) {
    var it = currentEditOrderItems[i]; var rowKg = (it.maund * 40) + it.kg;
    var amt = parseInt(it.amount) || 0;
    newItems.push({ product: it.product, maund: it.maund, kg: it.kg, deliveredMaund: 0, deliveredKg: 0, totalKg: rowKg, amount: amt });
    totalKg += rowKg; totalAmount += amt;
  }
  var orderId = currentEditingOrder.id;
  var orderToUpdate = currentEditingOrder;
  var shop = getShopById(orderToUpdate.shopId);
  var updates = { items: newItems, totalKg: totalKg, totalAmount: totalAmount, updatedAt: new Date().toISOString(), updatedBy: currentUser ? currentUser.user : 'unknown' };
  if (firebaseReady && orderId && String(orderId).indexOf('local_') !== 0) {
    db.collection('orders').doc(String(orderId)).update(updates).then(function() {
      orderToUpdate.items = newItems; orderToUpdate.totalKg = totalKg; orderToUpdate.totalAmount = totalAmount;
      orderToUpdate.updatedAt = updates.updatedAt; orderToUpdate.updatedBy = updates.updatedBy;
      if (btn) enableButton(btn);
      closeEditOrderModal(); renderOrdersPage(); renderDashboard();
      showToast('✅ Order update ho gaya!', 'success');
      if (shop && shop.mobile) openWhatsappEditShareModal(orderToUpdate, shop, oldItems, newItems);
    }).catch(function(e) { if (btn) enableButton(btn); showToast('❌ Update nahi ho saka: ' + e.message, 'error', 4000); });
  } else {
    orderToUpdate.items = newItems; orderToUpdate.totalKg = totalKg; orderToUpdate.totalAmount = totalAmount;
    orderToUpdate.updatedAt = updates.updatedAt; orderToUpdate.updatedBy = updates.updatedBy;
    if (btn) enableButton(btn);
    closeEditOrderModal(); renderOrdersPage(); renderDashboard();
    showToast('✅ Order update ho gaya (local)!', 'success');
    if (shop && shop.mobile) openWhatsappEditShareModal(orderToUpdate, shop, oldItems, newItems);
  }
}
function openCancelOrderModal(orderId) {
  if (!can('newOrder')) { showToast('Permission nahi hai', 'error'); return; }
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) return;
  if (order.status === 'Delivered') { showToast('Delivered order cancel nahi ho sakta', 'warning'); return; }
  currentCancellingOrderId = orderId;
  var shop = getShopById(order.shopId); var shopName = shop ? shop.name : 'Unknown';
  var textEl = document.getElementById('cancelOrderText');
  if (textEl) textEl.textContent = shopName + ' ka yeh order cancel karna hai?';
  var itemsText = '';
  for (var i = 0; i < order.items.length; i++) { var it = order.items[i]; itemsText += '• ' + it.product + ' — ' + qtyText(it.maund, it.kg) + '<br>'; }
  var bodyEl = document.getElementById('cancelOrderBody');
  if (bodyEl) bodyEl.innerHTML = '<div style="background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:12px;font-size:13px;color:#991b1b;">' + itemsText + '</div>';
  document.getElementById('cancelOrderModal').classList.add('active');
}
function closeCancelOrderModal() { document.getElementById('cancelOrderModal').classList.remove('active'); currentCancellingOrderId = null; }
function confirmCancelOrder(btn) {
  if (!currentCancellingOrderId) return;
  if (btn) disableButton(btn, 'Cancelling...');
  var orderId = currentCancellingOrderId; var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) { if (btn) enableButton(btn); closeCancelOrderModal(); return; }
  var shop = getShopById(order.shopId); var orderCopy = JSON.parse(JSON.stringify(order));
  if (firebaseReady && String(orderId).indexOf('local_') !== 0) {
    db.collection('orders').doc(String(orderId)).delete().then(function() {
      var newList = [];
      for (var i = 0; i < orders.length; i++) { if (orders[i].id != orderId) newList.push(orders[i]); }
      orders = newList;
      if (btn) enableButton(btn); closeCancelOrderModal(); cleanupRouteAfterDelivery();
      renderOrdersPage(); renderDashboard(); renderDelivery();
      showToast('✅ Order cancel ho gaya!', 'success');
      if (shop && shop.mobile) openWhatsappCancelShareModal(orderCopy, shop);
    }).catch(function(e) { if (btn) enableButton(btn); showToast('❌ Cancel nahi ho saka: ' + e.message, 'error', 4000); });
  } else {
    var newList = [];
    for (var i = 0; i < orders.length; i++) { if (orders[i].id != orderId) newList.push(orders[i]); }
    orders = newList;
    if (btn) enableButton(btn); closeCancelOrderModal(); cleanupRouteAfterDelivery();
    renderOrdersPage(); renderDashboard(); renderDelivery();
    showToast('✅ Order cancel ho gaya!', 'success');
    if (shop && shop.mobile) openWhatsappCancelShareModal(orderCopy, shop);
  }
}
function renderDelivery() {
  var pending = [];
  for (var i = 0; i < orders.length; i++) { 
    if (!isOrderInRange(orders[i].date, deliveryDateRange)) continue;
    if (orders[i].status === 'Pending' || orders[i].status === 'Partial') pending.push(orders[i]); 
  }
  var list = document.getElementById('deliveryList');
  if (pending.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Is range mein koi pending order nahi!</div>'; return; }
  var grouped = {};
  for (var i = 0; i < pending.length; i++) { var sid = pending[i].shopId; if (!grouped[sid]) grouped[sid] = []; grouped[sid].push(pending[i]); }
  var html = ''; var keys = Object.keys(grouped);
  for (var k = 0; k < keys.length; k++) {
    var shopId = keys[k]; var shopName = 'Unknown', shopMobile = ''; var shopObj = null;
    for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; shopMobile = shopkeepers[i].mobile; shopObj = shopkeepers[i]; } }
    var isFarzi = shopObj && shopObj.category === 'farzi';
    var sOrders = grouped[shopId]; var totalKg = 0; var totalAmt = 0;
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
      totalAmt += parseInt(o.totalAmount) || 0;
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        totalKg += (remM * 40) + remK;
      }
    }
    var linesHtml = '';
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i]; var userBadge = getUserBadgeHtml(o.createdBy, 'tiny');
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        var deliveredText = '';
        if (it.deliveredMaund > 0 || it.deliveredKg > 0) deliveredText = '<div class="p-delivered">✓ ' + qtyText(it.deliveredMaund, it.deliveredKg) + ' deliver</div>';
        var amtTag = '<span class="amt-tag">' + formatRs(it.amount || 0) + '</span>';
        var dateTag = '<span class="date-tag">📅 ' + formatDate(o.date) + '</span>';
        var action = can('deliver') ? '<button class="btn small success" onclick="openDeliverModal(\'' + o.id + '\', \'' + it.product.replace(/'/g, "\\'") + '\')"><i class="fa fa-check"></i> Delivered</button>' : '';
        linesHtml += '<div class="product-line"><div class="product-line-info order-line-with-user">' +
          userBadge + '<span class="p-name">📦 ' + it.product + '</span>' + amtTag + dateTag +
          '<span class="p-qty">' + qtyText(remM, remK) + '</span>' + deliveredText +
          '</div>' + action + '</div>';
      }
    }
    var offlineClass = sOrders[0]._offlinePending ? ' offline-pending' : '';
    var farziTag = isFarzi ? ' <span class="farzi-badge">FARZI</span>' : '';
    html += '<div class="shop-group' + offlineClass + (isFarzi ? ' farzi-card' : '') + '"><div class="shop-group-head">' +
      '<div><h4><i class="fa fa-store"></i> ' + shopName + farziTag + '</h4>' +
      '<p><i class="fa fa-phone"></i> ' + shopMobile + '</p></div>' +
      '<span class="shop-group-total">' + totalKgText(totalKg) + (totalAmt > 0 ? ' • ' + formatRs(totalAmt) : '') + '</span></div>' + linesHtml + '</div>';
  }
  list.innerHTML = html;
}
function switchHistoryTab(tab) {
  var tabSales = document.getElementById('tabSales');
  var tabLog = document.getElementById('tabLog');
  var salesTab = document.getElementById('salesReportTab');
  var logTab = document.getElementById('ordersLogTab');
  if (tab === 'sales') {
    tabSales.classList.add('active'); tabLog.classList.remove('active');
    salesTab.style.display = 'block'; logTab.style.display = 'none'; renderSalesReport();
  } else {
    tabSales.classList.remove('active'); tabLog.classList.add('active');
    salesTab.style.display = 'none'; logTab.style.display = 'block'; renderHistory();
  }
}
function populateSalesFilters() {
  var shopSel = document.getElementById('salesShopFilter');
  var prodSel = document.getElementById('salesProductFilter');
  if (shopSel) {
    var curShop = shopSel.value;
    shopSel.innerHTML = '<option value="all">All Shopkeepers</option>';
    for (var i = 0; i < shopkeepers.length; i++) shopSel.innerHTML += '<option value="' + shopkeepers[i].id + '">' + shopkeepers[i].name + '</option>';
    if (curShop) shopSel.value = curShop;
  }
  if (prodSel) {
    var curProd = prodSel.value;
    prodSel.innerHTML = '<option value="all">All Products</option>';
    for (var i = 0; i < products.length; i++) prodSel.innerHTML += '<option value="' + products[i] + '">' + products[i] + '</option>';
    if (curProd) prodSel.value = curProd;
  }
  var fromEl = document.getElementById('salesFromDate');
  var toEl = document.getElementById('salesToDate');
  if (fromEl && !fromEl.value) { var d = new Date(); d.setDate(d.getDate() - 30); fromEl.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  if (toEl && !toEl.value) toEl.value = todayStr();
}
function renderSalesReport() {
  var fromEl = document.getElementById('salesFromDate');
  var toEl = document.getElementById('salesToDate');
  var shopSel = document.getElementById('salesShopFilter');
  var prodSel = document.getElementById('salesProductFilter');
  var fromDate = fromEl ? fromEl.value : '';
  var toDate = toEl ? toEl.value : '';
  var shopFilter = shopSel ? shopSel.value : 'all';
  var prodFilter = prodSel ? prodSel.value : 'all';
  var filtered = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.status !== 'Delivered') continue;
    if (o._offlinePending) continue;
    if (fromDate && o.date < fromDate) continue;
    if (toDate && o.date > toDate) continue;
    if (shopFilter !== 'all' && o.shopId != shopFilter) continue;
    if (prodFilter !== 'all') {
      var hasProd = false;
      for (var j = 0; j < o.items.length; j++) { if (o.items[j].product === prodFilter) { hasProd = true; break; } }
      if (!hasProd) continue;
    }
    filtered.push(o);
  }
  var totalOrders = filtered.length, totalKg = 0, totalProducts = 0, totalAmount = 0;
  var productMap = {}, shopMap = {};
  for (var i = 0; i < filtered.length; i++) {
    var o = filtered[i]; var orderKg = 0;
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var m = parseInt(it.maund) || 0, k = parseInt(it.kg) || 0;
      var amt = parseInt(it.amount) || 0;
      if (prodFilter !== 'all' && it.product !== prodFilter) continue;
      var rowKg = m * 40 + k; orderKg += rowKg; totalProducts++;
      totalAmount += amt;
      if (!productMap[it.product]) productMap[it.product] = { kg: 0, orders: 0, amount: 0 };
      productMap[it.product].kg += rowKg; productMap[it.product].orders++; productMap[it.product].amount += amt;
    }
    totalKg += orderKg;
    if (!shopMap[o.shopId]) shopMap[o.shopId] = { orders: 0, kg: 0, amount: 0 };
    shopMap[o.shopId].orders++; shopMap[o.shopId].kg += orderKg;
    shopMap[o.shopId].amount += parseInt(o.totalAmount) || 0;
  }
  document.getElementById('salesTotalOrders').textContent = totalOrders;
  document.getElementById('salesTotalLoad').textContent = totalKgText(totalKg);
  document.getElementById('salesTotalProducts').textContent = totalProducts;
  var prodList = document.getElementById('salesProductWiseList');
  var prodKeys = Object.keys(productMap);
  prodKeys.sort(function(a, b) { return productMap[b].kg - productMap[a].kg; });
  document.getElementById('productWiseCount').textContent = prodKeys.length;
  if (prodKeys.length === 0) prodList.innerHTML = '<div class="empty"><i class="fa fa-box"></i>Koi sale nahi.</div>';
  else {
    var html = '';
    for (var p = 0; p < prodKeys.length; p++) {
      var pName = prodKeys[p]; var pd = productMap[pName];
      html += '<div class="sales-row" onclick="openSalesProductDetail(\'' + pName.replace(/'/g, "\\'") + '\')">' +
        '<div class="sr-name"><i class="fa fa-box"></i> ' + pName + '</div>' +
        '<div class="sr-stats"><span class="sr-badge">' + totalKgText(pd.kg) + '</span><span class="sr-badge blue">' + pd.orders + ' orders</span>' + (pd.amount > 0 ? '<span class="sr-badge amber">' + formatRs(pd.amount) + '</span>' : '') + '<i class="fa fa-chevron-right sr-arrow"></i></div></div>';
    }
    prodList.innerHTML = html;
  }
  var shopList = document.getElementById('salesShopWiseList');
  var shopKeys = Object.keys(shopMap);
  shopKeys.sort(function(a, b) { return shopMap[b].kg - shopMap[a].kg; });
  document.getElementById('shopWiseCount').textContent = shopKeys.length;
  if (shopKeys.length === 0) shopList.innerHTML = '<div class="empty"><i class="fa fa-store"></i>Koi order nahi.</div>';
  else {
    var html2 = '';
    for (var s = 0; s < shopKeys.length; s++) {
      var sid = shopKeys[s]; var sd = shopMap[sid]; var shopName = 'Unknown';
      for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == sid) { shopName = shopkeepers[i].name; break; } }
      html2 += '<div class="sales-row" onclick="openSalesShopDetail(\'' + sid + '\')">' +
        '<div class="sr-name"><i class="fa fa-store"></i> ' + shopName + '</div>' +
        '<div class="sr-stats"><span class="sr-badge">' + totalKgText(sd.kg) + '</span><span class="sr-badge blue">' + sd.orders + ' orders</span>' + (sd.amount > 0 ? '<span class="sr-badge amber">' + formatRs(sd.amount) + '</span>' : '') + '<i class="fa fa-chevron-right sr-arrow"></i></div></div>';
    }
    shopList.innerHTML = html2;
  }
}
function openSalesProductDetail(productName) {
  var fromDate = document.getElementById('salesFromDate').value;
  var toDate = document.getElementById('salesToDate').value;
  document.getElementById('salesProductModalTitle').textContent = productName + ' - Detail';
  var filtered = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.status !== 'Delivered') continue;
    if (o._offlinePending) continue;
    if (fromDate && o.date < fromDate) continue;
    if (toDate && o.date > toDate) continue;
    for (var j = 0; j < o.items.length; j++) { if (o.items[j].product === productName) { filtered.push({ order: o, item: o.items[j] }); break; } }
  }
  var body = document.getElementById('salesProductModalBody');
  if (filtered.length === 0) body.innerHTML = '<div class="empty">Koi order nahi.</div>';
  else {
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var fo = filtered[i]; var shopName = 'Unknown';
      for (var j = 0; j < shopkeepers.length; j++) { if (shopkeepers[j].id == fo.order.shopId) { shopName = shopkeepers[j].name; break; } }
      var it = fo.item;
      var amtTag = it.amount ? ' <span class="sd-total">' + formatRs(it.amount) + '</span>' : '';
      html += '<div class="sales-detail-row"><div><div style="font-weight:700;color:#1e293b;">' + shopName + '</div><div class="sd-date">' + formatDate(fo.order.date) + '</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><div class="sd-total">' + qtyText(it.maund, it.kg) + '</div>' + amtTag + '</div></div>';
    }
    body.innerHTML = html;
  }
  document.getElementById('salesProductModal').classList.add('active');
}
function closeSalesProductModal() { document.getElementById('salesProductModal').classList.remove('active'); }
function openSalesShopDetail(shopId) {
  var fromDate = document.getElementById('salesFromDate').value;
  var toDate = document.getElementById('salesToDate').value;
  var shopName = 'Unknown';
  for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; break; } }
  document.getElementById('salesShopModalTitle').textContent = shopName + ' - Orders';
  var filtered = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.status !== 'Delivered') continue;
    if (o._offlinePending) continue;
    if (o.shopId != shopId) continue;
    if (fromDate && o.date < fromDate) continue;
    if (toDate && o.date > toDate) continue;
    filtered.push(o);
  }
  filtered.reverse();
  var body = document.getElementById('salesShopModalBody');
  if (filtered.length === 0) body.innerHTML = '<div class="empty">Koi order nahi.</div>';
  else {
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var o = filtered[i]; var itemsHtml = ''; var totalKg = 0;
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var rowKg = (parseInt(it.maund) || 0) * 40 + (parseInt(it.kg) || 0);
        totalKg += rowKg;
        var amtTag = it.amount ? ' <span class="sd-total">' + formatRs(it.amount) + '</span>' : '';
        itemsHtml += '<div class="sales-detail-row"><div class="sd-items">📦 ' + it.product + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;"><div class="sd-total">' + qtyText(it.maund, it.kg) + '</div>' + amtTag + '</div></div>';
      }
      html += '<div style="margin-bottom:14px;border-bottom:1px dashed #e2e8f0;padding-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<strong style="color:#16a34a;">' + formatDate(o.date) + '</strong>' +
        '<span class="sd-total">' + totalKgText(totalKg) + '</span></div>' + itemsHtml + '</div>';
    }
    body.innerHTML = html;
  }
  document.getElementById('salesShopModal').classList.add('active');
}
function closeSalesShopModal() { document.getElementById('salesShopModal').classList.remove('active'); }
function renderHistory() {
  var searchEl = document.getElementById('historySearch');
  var dateEl = document.getElementById('historyDate');
  var search = searchEl ? searchEl.value.toLowerCase() : '';
  var dateFilter = dateEl ? dateEl.value : '';
  var filtered = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.status !== 'Delivered') continue;
    if (o._offlinePending) continue;
    if (dateFilter && o.date !== dateFilter) continue;
    if (search) {
      var shopName = '';
      for (var j = 0; j < shopkeepers.length; j++) { if (shopkeepers[j].id == o.shopId) shopName = shopkeepers[j].name.toLowerCase(); }
      if (shopName.indexOf(search) === -1) continue;
    }
    filtered.push(o);
  }
  filtered.reverse();
  var list = document.getElementById('historyList');
  if (filtered.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-clock"></i>Koi history nahi.</div>'; return; }
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var o = filtered[i]; var shopName = 'Unknown';
    for (var j = 0; j < shopkeepers.length; j++) { if (shopkeepers[j].id == o.shopId) shopName = shopkeepers[j].name; }
    var itemsHtml = '';
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var amtTag = it.amount ? ' <b>' + formatRs(it.amount) + '</b>' : '';
      itemsHtml += '<p>• ' + it.product + ' — <b>' + qtyText(it.maund, it.kg) + '</b>' + amtTag + '</p>';
    }
    html += '<div class="item delivered-item" onclick="openOrderDetailModal(\'' + o.shopId + '\', {readOnly:true})" style="cursor:pointer;"><div class="item-info">' +
      '<h4>' + getUserBadgeHtml(o.createdBy, 'tiny') + ' ' + shopName + '</h4>' + itemsHtml +
      '<p class="date-line"><i class="fa fa-calendar"></i> ' + formatDate(o.date) + '</p>' +
      '<span class="badge delivered">Delivered' + (o.totalAmount ? ' • ' + formatRs(o.totalAmount) : '') + '</span></div></div>';
  }
  list.innerHTML = html;
}
function clearHistoryFilter() {
  document.getElementById('historySearch').value = '';
  document.getElementById('historyDate').value = '';
  renderHistory();
}
function viewShopHistory(shopId) {
  var shopName = '';
  for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopId) shopName = shopkeepers[i].name; }
  var sOrders = [];
  for (var i = 0; i < orders.length; i++) { if (orders[i].shopId == shopId) sOrders.push(orders[i]); }
  sOrders.reverse();
  document.getElementById('modalTitle').textContent = shopName + ' - Orders';
  var body = document.getElementById('modalBody');
  if (sOrders.length === 0) body.innerHTML = '<div class="empty">Abhi koi order nahi.</div>';
  else {
    var html = '';
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i]; var itemsHtml = '';
      for (var j = 0; j < o.items.length; j++) itemsHtml += '<p><b>' + o.items[j].product + '</b> — ' + qtyText(o.items[j].maund, o.items[j].kg) + '</p>';
      var st = o.status.toLowerCase();
      if (o.status === 'Partial') st = 'partial';
      html += '<div class="item ' + (o.status === 'Delivered' ? 'delivered-item' : 'pending-item') + '" style="margin-bottom:10px;">' +
        '<div class="item-info">' + getUserBadgeHtml(o.createdBy, 'tiny') + itemsHtml +
        '<p><small>' + formatDate(o.date) + '</small></p>' +
        '<span class="badge ' + st + '">' + o.status + '</span></div></div>';
    }
    body.innerHTML = html;
  }
  document.getElementById('modal').classList.add('active');
}
function closeModal() { document.getElementById('modal').classList.remove('active'); }

function migrateLegacyData(user, callback) {
  if (user.businessId) { if (callback) callback(); return; }
  var legacyId = LEGACY_BUSINESS_ID;
  var legacyName = user.display || user.user || 'Legacy Business';
  db.collection('users').doc(String(user.id)).update({ businessId: legacyId, businessName: legacyName }).then(function() {
    user.businessId = legacyId; user.businessName = legacyName;
    localStorage.setItem('currentUser', JSON.stringify(user));
    db.collection('settings').doc('business_' + legacyId).set({ bizName: legacyName, businessId: legacyId }).catch(function(e) { console.log(e); });
    db.collection('settings').doc('products').get().then(function(doc) {
      if (doc.exists) {
        var prodList = doc.data().list || [];
        if (prodList.length > 0) db.collection('settings').doc('products_' + legacyId).set({ list: prodList, businessId: legacyId }).catch(function(e) { console.log(e); });
      }
    }).catch(function(e) { console.log(e); });
    var collections = ['shopkeepers', 'orders', 'routes', 'accounts', 'whatsappQueue'];
    var chain = Promise.resolve();
    collections.forEach(function(colName) {
      chain = chain.then(function() {
        return db.collection(colName).get().then(function(snap) {
          if (snap.empty) return;
          var batch = db.batch(); var count = 0;
          snap.forEach(function(doc) { var d = doc.data(); if (!d.businessId) { batch.update(doc.ref, { businessId: legacyId }); count++; } });
          if (count > 0) return batch.commit();
        });
      });
    });
    chain.then(function() { return db.collection('users').get(); }).then(function(snap) {
      if (!snap || snap.empty) return;
      var batch = db.batch(); var count = 0;
      snap.forEach(function(doc) {
        var d = doc.data();
        if (!d.businessId && doc.id !== String(user.id)) { batch.update(doc.ref, { businessId: legacyId }); count++; }
      });
      if (count > 0) return batch.commit();
    }).then(function() { console.log('✅ Legacy migration complete'); if (callback) callback(); })
    .catch(function(e) { console.log('Legacy migration error:', e); if (callback) callback(); });
  }).catch(function(e) { console.log('User migration error:', e); if (callback) callback(); });
}

window.addEventListener('load', function() {
  applySettings(); updateOnlineStatus(); showSplashScreen();
  loadQueueFromLocalStorage();
  loadAccountsQueueFromLocalStorage();
  var loggedIn = localStorage.getItem('isLoggedIn') === 'true';
  var cachedUser = JSON.parse(localStorage.getItem('currentUser'));
  if (loggedIn && cachedUser) {
    currentUser = cachedUser; isLoggedIn = true;
    currentBusinessId = cachedUser.businessId || null;
    currentBusinessName = cachedUser.businessName || null;
    initFirebase(function() {
      setTimeout(function() {
        decideStartupScreen();
        if (firebaseReady) loadAllData(function() { console.log('✅ Background data loaded'); });
      }, 300);
    });
    return;
  }
  initFirebase(function() { setTimeout(function() { decideStartupScreen(); }, 300); });
});
function decideStartupScreen() {
  var loggedIn = localStorage.getItem('isLoggedIn') === 'true';
  var cachedUser = JSON.parse(localStorage.getItem('currentUser'));
  if (loggedIn && cachedUser) {
    currentUser = cachedUser; isLoggedIn = true;
    currentBusinessId = cachedUser.businessId || null;
    currentBusinessName = cachedUser.businessName || null;
    if (currentUser.pin && String(currentUser.pin).length === 4) showPinScreenOnly();
    else { showAppScreenOnly(); showApp(); }
    if (!currentBusinessId && firebaseReady) {
      migrateLegacyData(currentUser, function() {
        currentBusinessId = currentUser.businessId;
        currentBusinessName = currentUser.businessName;
        if (currentBusinessId) {
          setupRealtimeListeners();
          showToast('✅ Aap ka purana data migrate ho gaya', 'success', 4000);
        }
      });
    }
    return;
  }
  showLoginScreenOnly();
}
