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

// ================== DATA ==================
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
  { key: 'delivery', label: 'Delivery', icon: 'fa-check-circle', show: true },
  { key: 'history', label: 'History', icon: 'fa-clock', show: true },
  { key: 'users', label: 'Users', icon: 'fa-user-shield', show: true },
  { key: 'settings', label: 'Settings', icon: 'fa-gear', show: true }
];

var DEFAULT_DASHBOARD = [
  { key: 'bigButtons', label: 'Big Buttons', show: true, size: 100, view: 'grid' },
  { key: 'cards', label: '4 Cards', show: true, size: 100, view: 'grid' },
  { key: 'pendingShops', label: "Today's Pending Shops", show: true, size: 100, view: 'list' },
  { key: 'load', label: 'Aaj Ka Load', show: true, size: 100, view: 'list' },
  { key: 'routes', label: 'Aaj Ke Routes', show: true, size: 100, view: 'list' }
];

// ================== USER HELPERS ==================
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
function getCurrentDateTimeText() {
  var d = new Date();
  return formatDateTimeObj(d);
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

// ================== BACK BUTTON ==================
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

// ================== SPLASH / SCREEN HELPERS ==================
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

// ================== TOAST ==================
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

// ================== BUTTON LOADING ==================
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

// ================== ONLINE / OFFLINE ==================
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  updateSyncStatusIndicator(); updateOfflineBanner(); updatePendingBanner(); updateSettingsSyncStatus();
}
window.addEventListener('online', function() { isOnline = true; updateOnlineStatus(); showToast('🌐 Internet wapas aa gaya — sync ho raha hai...', 'success', 2500); });
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
}

// ================== FIREBASE LISTENERS ==================
function setupRealtimeListeners() {
  if (!firebaseReady) return;
  if (!snapshotListeners.shopkeepers) {
    snapshotListeners.shopkeepers = db.collection('shopkeepers').onSnapshot(function(snap) {
      shopkeepers = []; snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; shopkeepers.push(d); });
      refreshAllViews();
    }, function(err) { console.log('Shopkeepers listener:', err); });
  }
  if (!snapshotListeners.orders) {
    snapshotListeners.orders = db.collection('orders').onSnapshot(function(snap) {
      orders = []; snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; d._offlinePending = false; orders.push(d); });
      offlineOrdersQueue = []; refreshAllViews();
    }, function(err) { console.log('Orders listener:', err); });
  }
  if (!snapshotListeners.products) {
    snapshotListeners.products = db.collection('settings').doc('products').onSnapshot(function(doc) {
      if (doc.exists) products = doc.data().list || products; refreshAllViews();
    }, function(err) { console.log('Products listener:', err); });
  }
  if (!snapshotListeners.business) {
    snapshotListeners.business = db.collection('settings').doc('business').onSnapshot(function(doc) {
      if (doc.exists) { var d = doc.data(); if (d.bizName) settings.bizName = d.bizName; } applySettings();
    }, function(err) { console.log('Business listener:', err); });
  }
  if (!snapshotListeners.users) {
    snapshotListeners.users = db.collection('users').onSnapshot(function(snap) {
      users = []; snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; users.push(d); });
      if (currentUser) { for (var i = 0; i < users.length; i++) { if (users[i].id === currentUser.id) { currentUser = users[i]; localStorage.setItem('currentUser', JSON.stringify(currentUser)); break; } } }
      if (isAdmin()) renderUsers();
      refreshAllViews();
    }, function(err) { console.log('Users listener:', err); });
  }
  if (!snapshotListeners.routes) {
    snapshotListeners.routes = db.collection('routes').onSnapshot(function(snap) {
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
  firstLoadDone = true;
}
function refreshAllViews() {
  if (!currentUser) return;
  mergeOfflineOrders(); mergeOfflineRoutes();
  renderDashboard(); renderShopkeepers(); renderRoutes(); renderHistory();
  renderRouteShopPicker(); applyDashboardLayout(); renderHiddenMenuList(); populateSalesFilters();
  var ordPage = document.getElementById('orders'); if (ordPage && ordPage.classList.contains('active')) renderOrdersPage();
  var delPage = document.getElementById('delivery'); if (delPage && delPage.classList.contains('active')) renderDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
}
function mergeOfflineOrders() {
  if (offlineOrdersQueue.length === 0) return;
  var stillPending = [];
  for (var i = 0; i < offlineOrdersQueue.length; i++) {
    var off = offlineOrdersQueue[i];
    var foundOnFirebase = false;
    for (var j = 0; j < orders.length; j++) { if (orders[j].createdAt === off.createdAt && orders[j].shopId == off.shopId) { foundOnFirebase = true; break; } }
    if (!foundOnFirebase) { off._offlinePending = true; stillPending.push(off); }
  }
  offlineOrdersQueue = stillPending;
  for (var i = 0; i < offlineOrdersQueue.length; i++) {
    var off = offlineOrdersQueue[i];
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
    var foundOnFirebase = false;
    for (var j = 0; j < routes.length; j++) { if (routes[j].createdAt === off.createdAt && routes[j].name === off.name) { foundOnFirebase = true; break; } }
    if (!foundOnFirebase) stillPending.push(off);
  }
  offlineRoutesQueue = stillPending;
  for (var i = 0; i < offlineRoutesQueue.length; i++) {
    var off = offlineRoutesQueue[i];
    var exists = false;
    for (var j = 0; j < routes.length; j++) { if (routes[j].id === off.id) { exists = true; break; } }
    if (!exists) routes.push(off);
  }
}
function loadAllData(callback) { setupRealtimeListeners(); setTimeout(function() { if (callback) callback(); }, 800); }
function saveToFirebase(collection, id, data) {
  if (!firebaseReady) return Promise.reject('Firebase not ready');
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
  if (!firebaseReady) return;
  saveToFirebase('settings', 'products', { list: products });
  saveToFirebase('settings', 'business', { bizName: settings.bizName });
}

// ================== RESET ALL DATA ==================
function confirmResetAllData() {
  if (!isAdmin()) { showToast('Sirf Admin reset kar sakta hai', 'error'); return; }
  resetConfirmStage = 0;
  var textEl = document.getElementById('resetConfirmText');
  var bodyEl = document.getElementById('resetConfirmBody');
  var btnEl = document.getElementById('resetConfirmBtn');
  if (textEl) textEl.textContent = 'Pakka reset karna hai? Saara data delete ho jayega.';
  if (bodyEl) bodyEl.innerHTML = '<p style="color:#64748b;font-size:14px;margin:10px 0;">Ye delete hoga: <b>Shopkeepers, Products, Orders, Routes</b><br>Ye safe rahega: <b>Users, PIN, Business Name</b></p>';
  if (btnEl) btnEl.innerHTML = '<i class="fa fa-arrow-right"></i> Haan, Aage Badhein';
  document.getElementById('resetConfirmModal').classList.add('active');
}
function proceedResetConfirm() {
  if (resetConfirmStage === 0) {
    resetConfirmStage = 1;
    var textEl = document.getElementById('resetConfirmText');
    var bodyEl = document.getElementById('resetConfirmBody');
    var btnEl = document.getElementById('resetConfirmBtn');
    if (textEl) textEl.textContent = '⚠️ Aakhri baar pooch rahe hain — SAB KUCH delete ho jayega!';
    if (bodyEl) bodyEl.innerHTML = '<p style="color:#dc2626;font-size:14px;margin:10px 0;font-weight:600;">Ye action undo nahi ho sakta. Shopkeepers, Products, Orders, aur Routes — sab permanently delete ho jayega.</p>';
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
  showToast('⏳ Reset ho raha hai...', 'info', 5000);
  db.collection('shopkeepers').get().then(function(snap) {
    var batch = db.batch(); snap.forEach(function(doc) { batch.delete(doc.ref); }); return batch.commit();
  }).then(function() { return db.collection('orders').get(); })
  .then(function(snap) { var batch = db.batch(); snap.forEach(function(doc) { batch.delete(doc.ref); }); return batch.commit(); })
  .then(function() { return db.collection('routes').get(); })
  .then(function(snap) { var batch = db.batch(); snap.forEach(function(doc) { batch.delete(doc.ref); }); return batch.commit(); })
  .then(function() { return db.collection('settings').doc('products').set({ list: [] }); })
  .then(function() {
    shopkeepers = []; orders = []; routes = []; products = [];
    offlineOrdersQueue = []; offlineRoutesQueue = [];
    renderDashboard(); renderShopkeepers(); renderRoutes(); renderHistory(); renderSettings(); renderRouteShopPicker(); populateSalesFilters();
    if (isAdmin()) renderUsers();
    showToast('✅ Saara data reset ho gaya!', 'success', 4000);
  }).catch(function(e) { console.log('Reset error:', e); showToast('❌ Reset mein masla: ' + (e.message || 'Unknown'), 'error', 5000); });
}

// ================== LAYOUT ==================
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

// ================== MENU EDIT ==================
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

// ================== DASHBOARD EDIT ==================
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

// ================== WHATSAPP HELPERS ==================
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
  for (var i = 0; i < items.length; i++) { var it = items[i]; var qty = qtyText(it.maund, it.kg); lines.push('• ' + it.product + ' — ' + qty); }
  return lines.join('\n');
}

function openWhatsappShareModal(order, shop) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile); if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var itemsText = formatOrderItemsText(order.items);
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    '📅 ' + getOrderDateTimeText(order) + '\n\n' +
    'Aap ka order book ho chuka hai:\n\n' + itemsText + '\n\n' +
    'Inshallah jald hi deliver ho jayega.\nShukriya!\n- ' + bizName + '\n\n' +
    '👤 Created by: ' + getCurrentUserDisplayForWa();
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
    if (dm > 0 || dk > 0) lines.push('• ' + it.product + ' — ' + qtyText(dm, dk));
    else { var m = parseInt(it.maund) || 0, k = parseInt(it.kg) || 0; lines.push('• ' + it.product + ' — ' + qtyText(m, k)); }
  }
  var itemsText = lines.join('\n');
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    '📅 ' + getCurrentDateTimeText() + '\n\n' +
    'Aap ka order deliver ho chuka hai:\n\n' + itemsText + '\n\n' +
    'Shukriya!\n- ' + bizName + '\n\n' +
    '👤 Delivered by: ' + getCurrentUserDisplayForWa();
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
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    '📅 ' + getCurrentDateTimeText() + '\n\n' +
    'Aap ka order deliver ho chuka hai:\n\n' + itemsText + '\n\n' +
    'Shukriya!\n- ' + bizName + '\n\n' +
    '👤 Delivered by: ' + getCurrentUserDisplayForWa();
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappUrl = url; pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}

// ✅ EDIT — ab asal order ki date/time bracket mein aayegi
function openWhatsappEditShareModal(order, shop, oldItems, newItems) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile); if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';

  var tableLines = [];
  for (var i = 0; i < oldItems.length; i++) {
    var oi = oldItems[i];
    var found = false;
    for (var j = 0; j < newItems.length; j++) {
      if (newItems[j].product === oi.product) {
        var oldQty = qtyText(oi.maund, oi.kg);
        var newQty = qtyText(newItems[j].maund, newItems[j].kg);
        if (oldQty === newQty) {
          tableLines.push('• ' + oi.product + ' — ' + oldQty);
        } else {
          tableLines.push('❌ ' + oi.product + ' — ' + oldQty);
          tableLines.push('✅ ' + oi.product + ' — ' + newQty);
        }
        found = true; break;
      }
    }
    if (!found) tableLines.push('❌ ' + oi.product + ' — ' + qtyText(oi.maund, oi.kg));
  }
  for (var j = 0; j < newItems.length; j++) {
    var nj = newItems[j];
    var existsOld = false;
    for (var i = 0; i < oldItems.length; i++) { if (oldItems[i].product === nj.product) { existsOld = true; break; } }
    if (!existsOld) tableLines.push('✅ ' + nj.product + ' — ' + qtyText(nj.maund, nj.kg));
  }

  var tableText = tableLines.join('\n');
  var originalDateTime = getOrderDateTimeText(order);

  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    '📅 ' + getCurrentDateTimeText() + '\n\n' +
    'Aap ne is tarikh (' + originalDateTime + ') ko yeh order diya tha, aur yeh ismein tabdeeli ki gayi hai:\n\n' +
    tableText + '\n\n' +
    'Shukriya!\n- ' + bizName + '\n\n' +
    '👤 Updated by: ' + getCurrentUserDisplayForWa();
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  pendingWhatsappUrl = url; pendingWhatsappMessage = msg;
  var modal = document.getElementById('whatsappShareModal');
  var msgBox = document.getElementById('whatsappShareMessage');
  if (msgBox) msgBox.textContent = msg;
  if (modal) modal.classList.add('active');
}

// ✅ CANCEL — ab asal order ki date/time bracket mein aayegi
function openWhatsappCancelShareModal(order, shop) {
  if (!shop || !shop.mobile) return;
  var number = formatWaNumber(shop.mobile); if (!number) return;
  var bizName = settings.bizName || 'Atta Chakki';
  var itemsText = formatOrderItemsText(order.items);
  var originalDateTime = getOrderDateTimeText(order);

  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    '📅 ' + getCurrentDateTimeText() + '\n\n' +
    'Aap ne is tarikh (' + originalDateTime + ') ko yeh order diya tha, aur yeh cancel ho gaya hai:\n\n' +
    itemsText + '\n\n' +
    'Shukriya!\n- ' + bizName + '\n\n' +
    '👤 Cancelled by: ' + getCurrentUserDisplayForWa();
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

// ================== ROUTE CLEANUP ==================
function cleanupRouteAfterDelivery() {
  if (!firebaseReady) return;
  var routesChanged = false;
  for (var r = routes.length - 1; r >= 0; r--) {
    var route = routes[r];
    var items = (route.items || []).slice();
    var newItems = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var stillPending = false;
      for (var j = 0; j < orders.length; j++) {
        var o = orders[j];
        if (o.shopId != it.shopId) continue;
        if (o.status !== 'Pending' && o.status !== 'Partial') continue;
        for (var k = 0; k < o.items.length; k++) {
          var oi = o.items[k];
          if (oi.product !== it.product) continue;
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

// ================== AUTO DATE SHIFT ==================
function autoShiftPendingOrders() {
  if (!firebaseReady) return;
  var today = todayStr(); var shifted = 0;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if ((o.status === 'Pending' || o.status === 'Partial') && o.date !== today && o.date < today) {
      o.date = today; o.autoShifted = true; saveToFirebase('orders', o.id, o); shifted++;
    }
  }
  if (shifted > 0) console.log(shifted + ' pending orders shifted');
}

// ================== NAVIGATION ==================
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

// ================== PIN SYSTEM ==================
function showPinScreen() { showPinScreenOnly(); }
function verifyPin() {
  var entered = document.getElementById('pinInput').value.trim();
  var err = document.getElementById('pinError');
  err.textContent = '';
  if (!entered || entered.length !== 4) { err.textContent = 'PIN 4-digit ka hona chahiye'; return; }
  if (!currentUser || !currentUser.pin) { err.textContent = 'PIN set nahi hai.'; return; }
  if (entered !== String(currentUser.pin)) { err.textContent = 'Ghalat PIN'; document.getElementById('pinInput').value = ''; return; }
  showAppScreenOnly(); showApp();
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
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}
function promptPinSetup() { if (currentUser && currentUser.pin) return; document.getElementById('pinSetupBanner').style.display = 'block'; }
function hidePinBanner() { document.getElementById('pinSetupBanner').style.display = 'none'; }
function openPinSetup() {
  document.getElementById('pinSetupTitle').textContent = 'PIN Set Karein';
  document.getElementById('newPin1').value = '';
  document.getElementById('newPin2').value = '';
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

// ================== PERMISSIONS ==================
function isAdmin() { return currentUser && currentUser.isAdmin === true; }
function can(permission) {
  if (!currentUser) return false;
  if (currentUser.isAdmin) return true;
  if (!currentUser.perms) return false;
  return currentUser.perms[permission] === true;
}

// ================== SIGNUP ==================
function doSignup() {
  var user = document.getElementById('signupUser').value.trim();
  var pass = document.getElementById('signupPass').value;
  var pass2 = document.getElementById('signupPass2').value;
  var err = document.getElementById('loginError');
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Username aur password daalein'; return; }
  if (pass.length < 4) { err.textContent = 'Password kam az kam 4 characters'; return; }
  if (pass !== pass2) { err.textContent = 'Password match nahi'; return; }
  if (!firebaseReady) { err.textContent = 'Firebase load nahi hua.'; return; }
  if (!isOnline) { err.textContent = 'Internet zaroori hai'; return; }
  err.textContent = 'Account bana rahe hain...';
  db.collection('users').where('user', '==', user).get().then(function(snap) {
    if (!snap.empty) { err.textContent = 'Ye username pehle se mojood hai'; return; }
    var adminUser = {
      user: user, pass: pass, display: user, isAdmin: true, pin: '',
      perms: { newOrder: true, deliver: true, shopkeepers: true, history: true, settings: true, routes: true },
      menuLayout: JSON.parse(JSON.stringify(DEFAULT_MENU)),
      dashboardLayout: JSON.parse(JSON.stringify(DEFAULT_DASHBOARD)),
      createdAt: new Date().toISOString()
    };
    db.collection('users').add(adminUser).then(function(ref) {
      err.textContent = '';
      showToast('✅ Admin account ban gaya!', 'success', 4000);
      hideSignup();
      document.getElementById('loginUser').value = user;
      document.getElementById('loginPass').value = '';
    }).catch(function(e) { err.textContent = 'Error: ' + e.message; });
  }).catch(function(e) { err.textContent = 'Error: ' + e.message; });
}

// ================== LOGIN ==================
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
    localStorage.setItem('isLoggedIn', 'true'); localStorage.setItem('currentUser', JSON.stringify(found));
    if (currentUser.pin && String(currentUser.pin).length === 4) { showPinScreenOnly(); }
    else { showAppScreenOnly(); showApp(); setTimeout(function() { promptPinSetup(); }, 500); }
  }).catch(function(e) {
    var cachedUser = JSON.parse(localStorage.getItem('currentUser'));
    if (cachedUser && cachedUser.user === user && cachedUser.pass === pass) {
      currentUser = cachedUser; isLoggedIn = true;
      localStorage.setItem('isLoggedIn', 'true');
      if (currentUser.pin && String(currentUser.pin).length === 4) showPinScreenOnly();
      else { showAppScreenOnly(); showApp(); }
      return;
    }
    err.textContent = 'Login nahi ho saka.';
  });
}
function showSignup() { document.getElementById('signupSection').style.display = 'block'; document.getElementById('signupLinkBox').style.display = 'none'; document.getElementById('loginError').textContent = ''; }
function hideSignup() { document.getElementById('signupSection').style.display = 'none'; document.getElementById('signupLinkBox').style.display = 'block'; document.getElementById('signupUser').value = ''; document.getElementById('signupPass').value = ''; document.getElementById('signupPass2').value = ''; }
function doLogout() {
  if (!confirm('Logout karna hai?')) return;
  for (var key in snapshotListeners) { if (snapshotListeners[key]) { try { snapshotListeners[key](); } catch (e) {} } }
  snapshotListeners = {}; offlineOrdersQueue = []; offlineRoutesQueue = [];
  isLoggedIn = false; currentUser = null;
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
  renderDashboard(); renderShopkeepers(); prepareOrderForm();
  renderHistory(); renderSettings(); renderRoutes();
  renderRouteShopPicker(); renderPinSettings();
  applyDashboardLayout(); renderHiddenMenuList(); populateSalesFilters();
  if (isAdmin()) renderUsers();
  updateOnlineStatus();
  if (firebaseReady) { setupRealtimeListeners(); setTimeout(function() { autoShiftPendingOrders(); renderDashboard(); }, 1500); }
  initBackButtonHandling();
}

// ================== MANUAL SYNC ==================
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
    setupRealtimeListeners(); autoShiftPendingOrders();
    if (icon) icon.className = 'fa fa-sync-alt';
    if (btn) btn.disabled = false;
    showToast('✅ Sync ho gaya!', 'success', 2000);
  }, 600);
}

// ================== SIDEBAR ==================
function renderSidebarNav() {
  var nav = document.getElementById('sidebarNav');
  if (!nav || !menuLayout) return;
  var activePage = 'dashboard';
  var pages = document.querySelectorAll('.page.active');
  if (pages.length > 0) activePage = pages[0].id;
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
    var activeClass = (activePage === item.key) ? ' active' : '';
    html += '<button class="nav-btn' + activeClass + '" onclick="showPage(\'' + item.key + '\', this)"><i class="fa ' + item.icon + '"></i> <span>' + item.label + '</span></button>';
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

// ================== HELPERS ==================
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

// ================== PAGE NAVIGATION ==================
function showPage(pageId, btn) {
  if (pageId === 'neworder' && !can('newOrder')) { alert('Permission nahi hai'); return; }
  if (pageId === 'shopkeepers' && !can('shopkeepers')) { alert('Permission nahi hai'); return; }
  if (pageId === 'history' && !can('history')) { alert('Permission nahi hai'); return; }
  if (pageId === 'settings' && !can('settings')) { alert('Permission nahi hai'); return; }
  if (pageId === 'users' && !isAdmin()) { alert('Sirf Admin'); return; }
  if (pageId === 'routes' && !can('routes')) { alert('Permission nahi hai'); return; }

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

  if (pageId === 'dashboard') { mergeOfflineOrders(); mergeOfflineRoutes(); renderDashboard(); applyDashboardLayout(); }
  if (pageId === 'shopkeepers') renderShopkeepers();
  if (pageId === 'neworder') prepareOrderForm();
  if (pageId === 'orders') { var dEl = document.getElementById('ordersDate'); if (dEl && !dEl.value) dEl.value = todayStr(); mergeOfflineOrders(); renderOrdersPage(); }
  if (pageId === 'delivery') { mergeOfflineOrders(); renderDelivery(); }
  if (pageId === 'history') { renderHistory(); populateSalesFilters(); renderSalesReport(); }
  if (pageId === 'settings') { renderSettings(); renderPinSettings(); renderHiddenMenuList(); updateSettingsSyncStatus(); }
  if (pageId === 'users') renderUsers();
  if (pageId === 'routes') { renderRoutes(); renderRouteShopPicker(); }
  window.scrollTo(0, 0);
}

// ================== SETTINGS ==================
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

// ================== USERS ==================
function saveUser(btn) {
  if (!isAdmin()) { showToast('Sirf Admin', 'error'); return; }
  var id = document.getElementById('userId').value;
  var user = document.getElementById('newUserName').value.trim();
  var pass = document.getElementById('newUserPass').value;
  var display = document.getElementById('newUserDisplay').value.trim();
  if (!user || !pass) { showToast('Username aur password zaroori!', 'warning'); return; }
  if (pass.length < 4) { showToast('Password kam az kam 4 characters', 'warning'); return; }
  for (var i = 0; i < users.length; i++) { if (users[i].user === user && users[i].id != id) { showToast('Ye username pehle se mojood hai', 'error'); return; } }
  if (btn) disableButton(btn, 'Saving...');
  var perms = {
    newOrder: document.getElementById('permNewOrder').checked,
    deliver: document.getElementById('permDeliver').checked,
    shopkeepers: document.getElementById('permShopkeepers').checked,
    history: document.getElementById('permHistory').checked,
    settings: document.getElementById('permSettings').checked,
    routes: document.getElementById('permRoutes').checked
  };
  if (id) {
    for (var i = 0; i < users.length; i++) {
      if (users[i].id == id) {
        users[i].user = user; users[i].pass = pass;
        users[i].display = display || user; users[i].perms = perms;
        saveToFirebase('users', users[i].id, users[i]);
      }
    }
    setTimeout(function() { if (btn) enableButton(btn); showToast('✅ User save ho gaya!', 'success'); resetUserForm(); renderUsers(); }, 300);
    return;
  }
  var newUser = {
    user: user, pass: pass, display: display || user, isAdmin: false, perms: perms, pin: '',
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
      { k: 'settings', label: 'Settings' }, { k: 'routes', label: 'Routes' }
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

// ================== DASHBOARD ==================
function renderDashboard() {
  var today = todayStr();
  var dateLabel = document.getElementById('todayDateLabel');
  if (dateLabel) dateLabel.textContent = formatDateLong(today);
  document.getElementById('totalShopkeepers').textContent = shopkeepers.length;
  document.getElementById('todayOrders').textContent = orders.filter(function(o) { return o.date === today; }).length;
  document.getElementById('pendingOrders').textContent = orders.filter(function(o) { return o.status === 'Pending' || o.status === 'Partial'; }).length;
  document.getElementById('deliveredOrders').textContent = orders.filter(function(o) { return o.status === 'Delivered'; }).length;

  var todayPending = orders.filter(function(o) { return o.date === today && (o.status === 'Pending' || o.status === 'Partial'); });
  var totalKg = 0;
  for (var i = 0; i < todayPending.length; i++) {
    var o = todayPending[i];
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      totalKg += (remM * 40) + remK;
    }
  }
  document.getElementById('todayLoadBadge').textContent = totalKgText(totalKg);
  var list = document.getElementById('todayLoadList');
  if (todayPending.length === 0) {
    list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Aaj koi pending order nahi.</div>';
  } else {
    var byProduct = {};
    for (var i = 0; i < todayPending.length; i++) {
      var o = todayPending[i];
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
  var today = todayStr();
  var list = document.getElementById('pendingShopList');
  var badge = document.getElementById('pendingShopBadge');
  if (!list) return;
  var grouped = {};
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.date !== today) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    if (!grouped[o.shopId]) grouped[o.shopId] = { count: 0, usernames: {} };
    grouped[o.shopId].count++;
    if (o.createdBy) grouped[o.shopId].usernames[o.createdBy] = true;
  }
  var shopIds = Object.keys(grouped);
  if (badge) badge.textContent = shopIds.length;
  if (shopIds.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Aaj koi pending shopkeeper order nahi.</div>'; return; }
  var html = '';
  for (var k = 0; k < shopIds.length; k++) {
    var sid = shopIds[k]; var shopName = 'Unknown'; var hasOffline = false;
    for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == sid) shopName = shopkeepers[i].name; }
    for (var i = 0; i < orders.length; i++) { if (orders[i].shopId == sid && orders[i]._offlinePending) { hasOffline = true; break; } }
    var count = grouped[sid].count;
    var summaryText = getShopOrderSummaryText(sid);
    var offlineClass = hasOffline ? ' offline-pending' : '';
    var userBadgesHtml = '';
    var usernames = Object.keys(grouped[sid].usernames);
    for (var u = 0; u < usernames.length; u++) userBadgesHtml += getUserBadgeHtml(usernames[u], 'tiny');
    html += '<div class="pending-shop-name' + offlineClass + '" onclick="openPendingShopModal(\'' + sid + '\')">' +
      '<div class="psn-info">' +
        '<span class="name-text"><i class="fa fa-store shop-icon"></i> ' + shopName + ' ' + userBadgesHtml + '</span>' +
        (summaryText ? '<span class="psn-summary">📦 ' + summaryText + '</span>' : '') +
      '</div>' +
      '<span><span class="order-count">' + count + '</span><i class="fa fa-chevron-right arrow-icon"></i></span></div>';
  }
  list.innerHTML = html;
}

// ============ PENDING SHOP MODAL ============
function openPendingShopModal(shopId) {
  var today = todayStr();
  var shopName = 'Unknown', shopMobile = '';
  for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; shopMobile = shopkeepers[i].mobile; } }
  document.getElementById('pendingShopTitle').textContent = shopName + ' - Aaj Ke Orders';
  document.getElementById('pendingShopModal').setAttribute('data-shop-id', shopId);
  currentPendingShopId = shopId;
  var sOrders = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId == shopId && o.date === today && (o.status === 'Pending' || o.status === 'Partial')) sOrders.push(o);
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
      if (!productMap[pName]) { productMap[pName] = { maund: 0, kg: 0, kgList: [], orderIds: [] }; productOrder.push(pName); }
      productMap[pName].maund += remM; productMap[pName].kg += remK;
      if (remK > 0) productMap[pName].kgList.push(remK);
      if (productMap[pName].orderIds.indexOf(o.id) === -1) productMap[pName].orderIds.push(o.id);
    }
  }
  var grandTotalKg = 0; currentPendingProducts = [];
  for (var p = 0; p < productOrder.length; p++) {
    var pm = productMap[productOrder[p]];
    grandTotalKg += (pm.maund * 40) + pm.kg;
    currentPendingProducts.push({ product: productOrder[p], maund: pm.maund, kg: pm.kg, kgList: pm.kgList.slice(), orderIds: pm.orderIds.slice() });
  }
  var linesHtml = '';
  for (var p = 0; p < currentPendingProducts.length; p++) {
    var pd = currentPendingProducts[p];
    var qtyParts = [];
    if (pd.maund > 0) qtyParts.push(pd.maund + ' maund');
    for (var q = 0; q < pd.kgList.length; q++) qtyParts.push(pd.kgList[q] + ' kg');
    var qtyStr = qtyParts.join(', ') || '0 kg';
    linesHtml += '<div class="product-line selectable-line">' +
      '<label class="deliver-checkbox"><input type="checkbox" class="pending-item-check" data-idx="' + p + '" onchange="updateDeliverBtn()" /></label>' +
      '<div class="product-line-info"><span class="p-name">📦 ' + pd.product + '</span><span class="p-qty">' + qtyStr + '</span></div>' +
    '</div>';
  }
  var deliverBtnHtml = can('deliver') ? '<button class="btn primary small deliver-selected-btn" onclick="deliverSelectedItems(this)" id="deliverSelectedBtn" disabled><i class="fa fa-check"></i> Deliver (<span id="deliverCount">0</span>)</button>' : '';
  var selectAllHtml = '<button class="btn small" onclick="toggleSelectAllPending()" id="selectAllPendingBtn" style="width:100%;margin-top:10px;"><i class="fa fa-check-square"></i> Select All</button>';
  var html = '<div class="shop-group"><div class="shop-group-head">' +
    '<div style="flex:1;"><h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
    '<p><i class="fa fa-phone"></i> ' + shopMobile + ' • ' + formatDate(today) + '</p></div>' +
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
    }
    deliveredItemsForWa.push({ product: pd.product, maund: pd.maund, kg: pd.kg, kgList: pd.kgList.slice() });
  }
  setTimeout(function() {
    if (btn) enableButton(btn);
    cleanupRouteAfterDelivery(); refreshPendingShopModal();
    showToast('✅ Delivered mark ho gaya!', 'success');
    if (shop && shop.mobile && deliveredItemsForWa.length > 0) openWhatsappMultiDeliveredShareModal(deliveredItemsForWa, shop);
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
  var today = todayStr(); var stillPending = false;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId == currentShopId && o.date === today && (o.status === 'Pending' || o.status === 'Partial')) { stillPending = true; break; }
  }
  if (!stillPending) closePendingShopModal(); else openPendingShopModal(currentShopId);
}

// ================== SHOPKEEPERS ==================
function saveShopkeeper(btn) {
  if (!can('shopkeepers')) { showToast('Permission nahi hai', 'error'); return; }
  var id = document.getElementById('shopId').value;
  var name = document.getElementById('shopName').value.trim();
  var mobile = document.getElementById('shopMobile').value.trim();
  var address = document.getElementById('shopAddress').value.trim();
  if (!name || !mobile) { showToast('Naam aur mobile zaroori!', 'warning'); return; }
  if (btn) disableButton(btn, 'Saving...');
  var wasOffline = !isOnline;
  if (id) {
    for (var i = 0; i < shopkeepers.length; i++) {
      if (shopkeepers[i].id == id) {
        shopkeepers[i].name = name; shopkeepers[i].mobile = mobile; shopkeepers[i].address = address;
        saveToFirebase('shopkeepers', shopkeepers[i].id, shopkeepers[i]);
      }
    }
    setTimeout(function() {
      if (btn) enableButton(btn); resetShopForm(); renderShopkeepers(); populateSalesFilters();
      showToast(wasOffline ? '📴 Offline — local save' : '✅ Shopkeeper save!', wasOffline ? 'warning' : 'success', 4000);
    }, 300);
    return;
  }
  var newShop = { name: name, mobile: mobile, address: address, createdAt: new Date().toISOString() };
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
  if (shopkeepers.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-users"></i>Koi shopkeeper nahi.</div>'; return; }
  var html = '';
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i]; var total = 0, pending = 0;
    for (var j = 0; j < orders.length; j++) { if (orders[j].shopId == s.id) { total++; if (orders[j].status === 'Pending' || orders[j].status === 'Partial') pending++; } }
    var editBtns = '';
    if (can('shopkeepers')) {
      editBtns = '<button class="btn small" onclick="editShopkeeper(\'' + s.id + '\')"><i class="fa fa-edit"></i> Edit</button>' +
                 '<button class="btn small danger" onclick="deleteShopkeeper(\'' + s.id + '\')"><i class="fa fa-trash"></i></button>';
    }
    html += '<div class="item"><div class="item-info">' +
      '<h4><i class="fa fa-store"></i> ' + s.name + '</h4>' +
      '<p><i class="fa fa-phone"></i> ' + s.mobile + '</p>' +
      (s.address ? '<p><i class="fa fa-map-marker-alt"></i> ' + s.address + '</p>' : '') +
      '<p><small>' + total + ' total • ' + pending + ' pending</small></p></div>' +
      '<div class="item-actions"><button class="btn small" onclick="viewShopHistory(\'' + s.id + '\')"><i class="fa fa-history"></i> History</button>' + editBtns + '</div></div>';
  }
  list.innerHTML = html;
  if (!can('shopkeepers')) { var form = document.getElementById('shopkeeperFormBox'); if (form) form.style.display = 'none'; }
}

// ================== ROUTES ==================
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
function shopHasTodayPendingOrder(shopId) {
  var today = todayStr();
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue; if (o.date !== today) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    return true;
  }
  return false;
}
function getShopTodayProducts(shopId) {
  var today = todayStr(); var productMap = {}, productOrder = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue; if (o.date !== today) continue;
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
function getShopOrderSummaryText(shopId) {
  var prods = getShopTodayProducts(shopId); var parts = [];
  for (var i = 0; i < prods.length; i++) parts.push(prods[i].product + ': ' + prods[i].qtyStr);
  return parts.join(' • ');
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
    if (!shopHasTodayPendingOrder(s.id)) continue;
    visible.push(s);
  }
  if (visible.length === 0) { box.innerHTML = '<div class="route-empty-hint"><i class="fa fa-inbox"></i>Aaj koi free shopkeeper pending order nahi hai.</div>'; return; }
  var html = '';
  for (var i = 0; i < visible.length; i++) {
    var s = visible[i];
    var shopProducts = getShopTodayProducts(s.id);
    var selectedProducts = selectedRouteItems[s.id] || [];
    var shopSelected = selectedProducts.length > 0;
    var shopClass = 'route-shop-block'; if (shopSelected) shopClass += ' selected';
    html += '<div class="' + shopClass + '">' +
      '<div class="route-shop-head">' +
        '<input type="checkbox" ' + (shopSelected ? 'checked' : '') + ' onchange="toggleRouteShop(\'' + s.id + '\', this.checked)" />' +
        '<span class="rsh-name"><i class="fa fa-store"></i> ' + s.name + '</span>' +
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
  var newRoute = { name: name, items: items, createdBy: currentUser ? currentUser.user : 'unknown', createdAt: new Date().toISOString() };
  newRoute.id = 'local_route_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  if (firebaseReady) {
    db.collection('routes').add({ name: newRoute.name, items: newRoute.items, createdBy: newRoute.createdBy, createdAt: newRoute.createdAt }).then(function(ref) { newRoute.id = ref.id; }).catch(function(e) { console.log('Route add error:', e); });
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
  for (var i = 0; i < shopIds.length; i++) { if (shopHasTodayPendingOrder(shopIds[i])) pendingShopCount++; }
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
    else list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Aaj koi route pending nahi.</div>';
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
      var pName = prods[p]; var kgs = [], mTot = 0;
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
          if (remK > 0) kgs.push(remK);
        }
      }
      if (!productMap[pName]) { productMap[pName] = { maund: 0, kgList: [] }; productOrder2.push(pName); }
      productMap[pName].maund += mTot;
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
      itemsHtml += '<div class="route-product-line"><span class="rp-name">📦 ' + pName + '</span><span class="rp-qty">' + qtyStr + '</span></div>';
    }
    var deliverBtn = can('deliver') ? '<button class="btn small success route-shop-deliver-btn" onclick="openDeliverConfirmModal(\'' + route.id + '\', \'' + sid + '\')"><i class="fa fa-check"></i> Delivered</button>' : '';
    html += '<div class="route-detail-shop">' +
      '<div class="route-detail-shop-head">' +
        '<div style="flex:1;"><h4><i class="fa fa-store"></i> ' + shop.name + '</h4>' +
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
  if (nameEl) nameEl.textContent = shop.name + ' ke ye products deliver karein?';
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
    }
  }
  cleanupRouteAfterDelivery();
  setTimeout(function() {
    var routeModal = document.getElementById('routeModal');
    if (routeModal && routeModal.classList.contains('active')) openRouteModal(routeId);
    renderDashboardRoutes(); renderDashboard();
    showToast('✅ ' + shop.name + ' ke products deliver ho gaye!', 'success');
    if (shop && shop.mobile && deliveredItemsForWa.length > 0) openWhatsappMultiDeliveredShareModal(deliveredItemsForWa, shop);
  }, 300);
}

// ================== NEW ORDER ==================
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
    html += '<div class="shop-picker-card" onclick="selectShopkeeperForOrder(\'' + s.id + '\')">' +
      '<div class="sp-icon"><i class="fa fa-store"></i></div>' +
      '<div class="sp-name">' + s.name + '</div>' +
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
  isSavingOrder = true; if (btn) disableButton(btn, 'Saving...');
  var shopId = selectedShopIdForOrder; var date = todayStr();
  var notes = document.getElementById('orderNotes').value.trim();
  var items = []; var totalKg = 0;
  for (var i = 0; i < currentOrderItems.length; i++) {
    var it = currentOrderItems[i]; var rowKg = (it.maund * 40) + it.kg;
    items.push({ product: it.product, maund: it.maund, kg: it.kg, deliveredMaund: 0, deliveredKg: 0, totalKg: rowKg });
    totalKg += rowKg;
  }
  var newOrder = {
    shopId: shopId, items: items, totalKg: totalKg, date: date, notes: notes, status: 'Pending',
    createdBy: currentUser ? currentUser.user : 'unknown',
    createdAt: new Date().toISOString()
  };
  var shop = getShopById(shopId); var wasOffline = !isOnline;
  newOrder.id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  newOrder._offlinePending = wasOffline;
  db.collection('orders').add({
    shopId: newOrder.shopId, items: newOrder.items, totalKg: newOrder.totalKg,
    date: newOrder.date, notes: newOrder.notes, status: newOrder.status,
    createdBy: newOrder.createdBy, createdAt: newOrder.createdAt
  }).then(function(ref) { newOrder.id = ref.id; newOrder._offlinePending = false; }).catch(function(e) { console.log('Order add error:', e); });
  offlineOrdersQueue.push(newOrder);
  setTimeout(function() {
    mergeOfflineOrders(); isSavingOrder = false;
    if (btn) enableButton(btn);
    showToast(wasOffline ? '📴 Offline — order local save' : '✅ Order save ho gaya!', wasOffline ? 'warning' : 'success', 4000);
    prepareOrderForm(); showPage('dashboard');
    if (!wasOffline && shop && shop.mobile) openWhatsappShareModal(newOrder, shop);
  }, 200);
}

// ================== ORDERS PAGE ==================
function renderOrdersPage() {
  var dateVal = document.getElementById('ordersDate').value || todayStr();
  var statusFilter = document.getElementById('ordersStatus').value;
  var filtered = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.date !== dateVal) continue;
    if (statusFilter === 'Pending' && o.status === 'Delivered') continue;
    if (statusFilter === 'Delivered' && o.status !== 'Delivered') continue;
    filtered.push(o);
  }
  var list = document.getElementById('ordersList');
  var summary = document.getElementById('ordersSummary');
  if (filtered.length === 0) {
    summary.innerHTML = '<div><p>' + formatDate(dateVal) + ' ka load</p><div class="big-num">0 kg</div></div>';
    list.innerHTML = '<div class="empty"><i class="fa fa-truck"></i>Is din koi order nahi.</div>';
    return;
  }
  var totalKg = 0;
  for (var i = 0; i < filtered.length; i++) {
    var o = filtered[i];
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      totalKg += (remM * 40) + remK;
    }
  }
  summary.innerHTML = '<div><p>' + formatDate(dateVal) + ' ka baqi load</p><div class="big-num">' + totalKgText(totalKg) + '</div></div>';
  var grouped = {};
  for (var i = 0; i < filtered.length; i++) {
    var sid = filtered[i].shopId;
    if (!grouped[sid]) grouped[sid] = [];
    grouped[sid].push(filtered[i]);
  }
  var html = ''; var keys = Object.keys(grouped);
  for (var k = 0; k < keys.length; k++) {
    var shopId = keys[k]; var shopName = 'Unknown', shopAddress = '—', shopMobile = '';
    for (var i = 0; i < shopkeepers.length; i++) {
      if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; shopAddress = shopkeepers[i].address || '—'; shopMobile = shopkeepers[i].mobile; }
    }
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
        var action = can('deliver') ? '<button class="btn small success" onclick="openDeliverModal(\'' + o.id + '\', \'' + it.product.replace(/'/g, "\\'") + '\')"><i class="fa fa-check"></i> Delivered</button>' : '';
        orderItemsHtml += '<div class="product-line"><div class="product-line-info">' +
          '<span class="p-name">📦 ' + it.product + '</span>' +
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
      ordersHtml += '<div class="shop-group' + offlineClass + '" style="margin-top:10px;">' +
        '<div class="shop-group-head">' +
          '<div class="shop-group-head-with-user">' +
            getUserBadgeHtml(o.createdBy, 'small') +
            '<div class="shop-group-head-info">' +
              '<h4><i class="fa fa-receipt"></i> Order #' + (i + 1) + '</h4>' +
              '<p style="font-size:12px;color:#64748b;"><i class="fa fa-calendar"></i> ' + getOrderDateTimeText(o) + '</p>' +
              '<p style="font-size:12px;color:#64748b;">👤 ' + (function() { var u = findUserByUsername(o.createdBy); return u ? getUserDisplayName(u) : (o.createdBy || 'Unknown'); })() + '</p>' +
            '</div>' +
          '</div>' +
          '<span class="shop-group-total">' + totalKgText(orderTotalKg) + '</span>' +
        '</div>' + orderItemsHtml + editCancelHtml + '</div>';
    }
    html += '<div class="box" style="margin-bottom:14px;">' +
      '<div class="box-head">' +
        '<div><h2 style="font-size:16px;"><i class="fa fa-store"></i> ' + shopName + '</h2>' +
        '<p style="font-size:13px;color:#64748b;"><i class="fa fa-map-marker-alt"></i> ' + shopAddress + ' • <i class="fa fa-phone"></i> ' + shopMobile + '</p></div>' +
        '<span class="pill">' + totalKgText(shopKg) + '</span>' +
      '</div>' + ordersHtml + '</div>';
  }
  list.innerHTML = html;
}

// ================== DELIVER MODAL ==================
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
  closeDeliverModal(); cleanupRouteAfterDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  var shop = getShopById(order.shopId);
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
  closeDeliverModal(); cleanupRouteAfterDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  var shop = getShopById(order.shopId);
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
  }
  var waShop = null, waOrder = null;
  if (currentCombinedOrderIds.length > 0) {
    for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentCombinedOrderIds[0]) { waOrder = orders[i]; break; } }
    if (waOrder) waShop = getShopById(waOrder.shopId);
  }
  closeDeliverModal(); cleanupRouteAfterDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
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
  }
  var waShop = null, waOrder = null;
  if (currentCombinedOrderIds.length > 0) {
    for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentCombinedOrderIds[0]) { waOrder = orders[i]; break; } }
    if (waOrder) waShop = getShopById(waOrder.shopId);
  }
  closeDeliverModal(); cleanupRouteAfterDelivery();
  var pm = document.getElementById('pendingShopModal'); if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  showToast('✅ Poora deliver mark ho gaya!', 'success');
  if (waShop && waShop.mobile && waOrder) openWhatsappDeliveredShareModal(waOrder, waShop);
}

// ================== EDIT ORDER ==================
function openEditOrderModal(orderId) {
  if (!can('newOrder')) { showToast('Permission nahi hai', 'error'); return; }
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) { order = orders[i]; break; } }
  if (!order) return;
  if (order.status === 'Delivered') { showToast('Delivered order edit nahi ho sakta', 'warning'); return; }
  currentEditingOrder = order; currentEditOrderItems = [];
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    currentEditOrderItems.push({ product: it.product, maund: parseInt(it.maund) || 0, kg: parseInt(it.kg) || 0 });
  }
  var shop = getShopById(order.shopId);
  var nameEl = document.getElementById('editOrderShopName');
  if (nameEl) nameEl.textContent = shop ? shop.name : 'Unknown';
  var dateEl = document.getElementById('editOrderDateLabel');
  if (dateEl) dateEl.textContent = '📅 ' + getOrderDateTimeText(order);
  renderEditOrderItemsList();
  document.getElementById('editOrderModal').classList.add('active');
}
function renderEditOrderItemsList() {
  var list = document.getElementById('editOrderItemsList'); if (!list) return;
  if (currentEditOrderItems.length === 0) { list.innerHTML = '<div class="empty" style="padding:20px;"><i class="fa fa-box"></i>Koi item nahi. Naya item add karein.</div>'; return; }
  var html = '';
  for (var i = 0; i < currentEditOrderItems.length; i++) {
    var it = currentEditOrderItems[i];
    html += '<div class="edit-item-row">' +
      '<div class="eir-info"><span class="eir-name">📦 ' + it.product + '</span><span class="eir-qty">' + qtyText(it.maund, it.kg) + '</span></div>' +
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
  if (currentEditItemIndex === -1) currentEditOrderItems.push({ product: product, maund: maund, kg: kg });
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
  var newItems = []; var totalKg = 0;
  for (var i = 0; i < currentEditOrderItems.length; i++) {
    var it = currentEditOrderItems[i]; var rowKg = (it.maund * 40) + it.kg;
    newItems.push({ product: it.product, maund: it.maund, kg: it.kg, deliveredMaund: 0, deliveredKg: 0, totalKg: rowKg });
    totalKg += rowKg;
  }
  var orderId = currentEditingOrder.id;
  var orderToUpdate = currentEditingOrder;
  var shop = getShopById(orderToUpdate.shopId);
  var updates = { items: newItems, totalKg: totalKg, updatedAt: new Date().toISOString(), updatedBy: currentUser ? currentUser.user : 'unknown' };
  if (firebaseReady && orderId && String(orderId).indexOf('local_') !== 0) {
    db.collection('orders').doc(String(orderId)).update(updates).then(function() {
      orderToUpdate.items = newItems; orderToUpdate.totalKg = totalKg;
      orderToUpdate.updatedAt = updates.updatedAt; orderToUpdate.updatedBy = updates.updatedBy;
      if (btn) enableButton(btn);
      closeEditOrderModal(); renderOrdersPage(); renderDashboard();
      showToast('✅ Order update ho gaya!', 'success');
      if (shop && shop.mobile) openWhatsappEditShareModal(orderToUpdate, shop, oldItems, newItems);
    }).catch(function(e) { if (btn) enableButton(btn); showToast('❌ Update nahi ho saka: ' + e.message, 'error', 4000); });
  } else {
    orderToUpdate.items = newItems; orderToUpdate.totalKg = totalKg;
    orderToUpdate.updatedAt = updates.updatedAt; orderToUpdate.updatedBy = updates.updatedBy;
    if (btn) enableButton(btn);
    closeEditOrderModal(); renderOrdersPage(); renderDashboard();
    showToast('✅ Order update ho gaya (local)!', 'success');
    if (shop && shop.mobile) openWhatsappEditShareModal(orderToUpdate, shop, oldItems, newItems);
  }
}

// ================== CANCEL ORDER ==================
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

// ================== DELIVERY PAGE ==================
function renderDelivery() {
  var pending = [];
  for (var i = 0; i < orders.length; i++) { if (orders[i].status === 'Pending' || orders[i].status === 'Partial') pending.push(orders[i]); }
  var list = document.getElementById('deliveryList');
  if (pending.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Koi pending order nahi!</div>'; return; }
  var grouped = {};
  for (var i = 0; i < pending.length; i++) { var sid = pending[i].shopId; if (!grouped[sid]) grouped[sid] = []; grouped[sid].push(pending[i]); }
  var html = ''; var keys = Object.keys(grouped);
  for (var k = 0; k < keys.length; k++) {
    var shopId = keys[k]; var shopName = 'Unknown', shopMobile = '';
    for (var i = 0; i < shopkeepers.length; i++) { if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; shopMobile = shopkeepers[i].mobile; } }
    var sOrders = grouped[shopId]; var totalKg = 0;
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
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
        var action = can('deliver') ? '<button class="btn small success" onclick="openDeliverModal(\'' + o.id + '\', \'' + it.product.replace(/'/g, "\\'") + '\')"><i class="fa fa-check"></i> Delivered</button>' : '';
        linesHtml += '<div class="product-line"><div class="product-line-info order-line-with-user">' +
          userBadge + '<span class="p-name">📦 ' + it.product + '</span>' +
          '<span class="p-qty">' + qtyText(remM, remK) + '</span>' + deliveredText +
          '</div>' + action + '</div>';
      }
    }
    var offlineClass = sOrders[0]._offlinePending ? ' offline-pending' : '';
    html += '<div class="shop-group' + offlineClass + '"><div class="shop-group-head">' +
      '<div><h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
      '<p><i class="fa fa-phone"></i> ' + shopMobile + '</p></div>' +
      '<span class="shop-group-total">' + totalKgText(totalKg) + '</span></div>' + linesHtml + '</div>';
  }
  list.innerHTML = html;
}

// ================== HISTORY ==================
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
  var totalOrders = filtered.length, totalKg = 0, totalProducts = 0;
  var productMap = {}, shopMap = {};
  for (var i = 0; i < filtered.length; i++) {
    var o = filtered[i]; var orderKg = 0;
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var m = parseInt(it.maund) || 0, k = parseInt(it.kg) || 0;
      if (prodFilter !== 'all' && it.product !== prodFilter) continue;
      var rowKg = m * 40 + k; orderKg += rowKg; totalProducts++;
      if (!productMap[it.product]) productMap[it.product] = { kg: 0, orders: 0 };
      productMap[it.product].kg += rowKg; productMap[it.product].orders++;
    }
    totalKg += orderKg;
    if (!shopMap[o.shopId]) shopMap[o.shopId] = { orders: 0, kg: 0 };
    shopMap[o.shopId].orders++; shopMap[o.shopId].kg += orderKg;
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
        '<div class="sr-stats"><span class="sr-badge">' + totalKgText(pd.kg) + '</span><span class="sr-badge blue">' + pd.orders + ' orders</span><i class="fa fa-chevron-right sr-arrow"></i></div></div>';
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
        '<div class="sr-stats"><span class="sr-badge">' + totalKgText(sd.kg) + '</span><span class="sr-badge blue">' + sd.orders + ' orders</span><i class="fa fa-chevron-right sr-arrow"></i></div></div>';
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
      html += '<div class="sales-detail-row"><div><div style="font-weight:700;color:#1e293b;">' + shopName + '</div><div class="sd-date">' + formatDate(fo.order.date) + '</div></div><div class="sd-total">' + qtyText(it.maund, it.kg) + '</div></div>';
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
        itemsHtml += '<div class="sales-detail-row"><div class="sd-items">📦 ' + it.product + '</div><div class="sd-total">' + qtyText(it.maund, it.kg) + '</div></div>';
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
    for (var j = 0; j < o.items.length; j++) itemsHtml += '<p>• ' + o.items[j].product + ' — <b>' + qtyText(o.items[j].maund, o.items[j].kg) + '</b></p>';
    html += '<div class="item delivered-item"><div class="item-info">' +
      '<h4>' + getUserBadgeHtml(o.createdBy, 'tiny') + ' ' + shopName + '</h4>' + itemsHtml +
      '<p class="date-line"><i class="fa fa-calendar"></i> ' + formatDate(o.date) + '</p>' +
      '<span class="badge delivered">Delivered</span></div></div>';
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

// ================== INIT ==================
window.addEventListener('load', function() {
  applySettings(); updateOnlineStatus(); showSplashScreen();
  var loggedIn = localStorage.getItem('isLoggedIn') === 'true';
  var cachedUser = JSON.parse(localStorage.getItem('currentUser'));
  if (loggedIn && cachedUser) {
    currentUser = cachedUser; isLoggedIn = true;
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
    if (currentUser.pin && String(currentUser.pin).length === 4) showPinScreenOnly();
    else { showAppScreenOnly(); showApp(); }
    return;
  }
  showLoginScreenOnly();
}
