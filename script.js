// Restaurant POS System - Complete JavaScript

// Global Variables
let selectedItems = [];
let orderCounter = parseInt(localStorage.getItem('orderCounter')) || 1;
let ongoingOrders = JSON.parse(localStorage.getItem('ongoingOrders')) || [];
let completedOrders = JSON.parse(localStorage.getItem('completedOrders')) || [];
let menuItems = [];

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const navLinks = document.querySelectorAll('.nav-link');
const tabContents = document.querySelectorAll('.tab-content');
const menuItemsContainer = document.getElementById('menu-items-container');
const orderSummaryItems = document.getElementById('order-summary-items');
const orderSubtotal = document.getElementById('order-subtotal');
const orderTax = document.getElementById('order-tax');
const orderTotal = document.getElementById('order-total');
const orderDiscount = document.getElementById('order-discount');
const orderIdDisplay = document.getElementById('order-id-display');
const clearOrderBtn = document.getElementById('clear-order-btn');
const placeOrderBtn = document.getElementById('place-order-btn');
const menuSearch = document.getElementById('menu-search');
const categoryFilter = document.getElementById('category-filter');
const ongoingOrdersBody = document.getElementById('ongoing-orders-body');
const noOngoingOrders = document.getElementById('no-ongoing-orders');
const completedOrdersBody = document.getElementById('completed-orders-body');
const noCompletedOrders = document.getElementById('no-completed-orders');
const refreshOrdersBtn = document.getElementById('refresh-orders-btn');

// Date Filter Elements
const analyticsStartDate = document.getElementById('analytics-start-date');
const analyticsEndDate = document.getElementById('analytics-end-date');
const applyAnalyticsFilter = document.getElementById('apply-analytics-filter');
const completedStartDate = document.getElementById('completed-start-date');
const completedEndDate = document.getElementById('completed-end-date');
const applyCompletedFilter = document.getElementById('apply-completed-filter');

// Analytics Elements
const totalRevenue = document.getElementById('total-revenue');
const totalOrders = document.getElementById('total-orders');
const averageOrderValue = document.getElementById('average-order-value');
const mostPopularItem = document.getElementById('most-popular-item');
const recentOrdersBody = document.getElementById('recent-orders-body');

// Chart Variables
let revenueChart = null;
let orderTypeChart = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initMenuItems();
    initNavigation();
    initOrderHandling();
    initDateFilters();
    loadOngoingOrders();
    loadCompletedOrders();
    loadAnalytics();
    initOrderDetailsModal();
    initBusinessProfile();
    
    // Generate initial order ID
    updateOrderId();
});

// ==================== NAVIGATION ====================
function initNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');
            
            // Update active nav link
            navLinks.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show selected tab
            tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            
            // Load data for specific tabs
            if (tabId === 'ongoing-orders') {
                loadOngoingOrders();
            } else if (tabId === 'completed-orders') {
                loadCompletedOrders();
                initDateFilters();
            } else if (tabId === 'analytics') {
                loadAnalytics();
                initDateFilters();
            }
        });
    });
}

// ==================== MENU ITEMS ====================
function initMenuItems() {
    // Sample menu data
    menuItems = [
        { id: 1, name: 'Margherita Pizza', category: 'main-course', price: 299, description: 'Classic cheese pizza' },
        { id: 2, name: 'Pepperoni Pizza', category: 'main-course', price: 349, description: 'Pepperoni cheese pizza' },
        { id: 3, name: 'Garlic Bread', category: 'starters', price: 129, description: 'Freshly baked garlic bread' },
        { id: 4, name: 'French Fries', category: 'starters', price: 99, description: 'Crispy golden fries' },
        { id: 5, name: 'Chicken Burger', category: 'main-course', price: 199, description: 'Juicy chicken burger' },
        { id: 6, name: 'Veg Burger', category: 'main-course', price: 149, description: 'Fresh vegetable burger' },
        { id: 7, name: 'Pasta Alfredo', category: 'main-course', price: 279, description: 'Creamy white sauce pasta' },
        { id: 8, name: 'Pasta Arrabbiata', category: 'main-course', price: 259, description: 'Spicy red sauce pasta' },
        { id: 9, name: 'Chocolate Brownie', category: 'desserts', price: 149, description: 'Warm chocolate brownie' },
        { id: 10, name: 'Ice Cream Sundae', category: 'desserts', price: 129, description: 'Vanilla ice cream with toppings' },
        { id: 11, name: 'Coca Cola', category: 'beverages', price: 49, description: '500ml bottle' },
        { id: 12, name: 'Fresh Lime Soda', category: 'beverages', price: 79, description: 'Fresh lime with soda' },
        { id: 13, name: 'Coffee', category: 'beverages', price: 89, description: 'Hot/Cold coffee' },
        { id: 14, name: 'Tea', category: 'beverages', price: 49, description: 'Hot tea' },
        { id: 15, name: 'Paneer Tikka', category: 'starters', price: 229, description: 'Grilled cottage cheese' }
    ];
    
    renderMenuItems();
    
    // Search functionality
    menuSearch.addEventListener('input', function() {
        renderMenuItems();
    });
    
    // Category filter
    categoryFilter.addEventListener('change', function() {
        renderMenuItems();
    });
}

function renderMenuItems() {
    const searchTerm = menuSearch.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    
    // Filter menu items
    let filteredItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                            item.description.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    
    // Group by category
    const groupedItems = {};
    filteredItems.forEach(item => {
        if (!groupedItems[item.category]) {
            groupedItems[item.category] = [];
        }
        groupedItems[item.category].push(item);
    });
    
    // Clear container
    menuItemsContainer.innerHTML = '';
    
    // Render categories
    const categories = ['starters', 'main-course', 'desserts', 'beverages'];
    
    categories.forEach(category => {
        if (groupedItems[category] && groupedItems[category].length > 0) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'menu-category';
            categoryDiv.innerHTML = `
                <h6>${getCategoryName(category)}</h6>
                <div class="row">
                    ${groupedItems[category].map(item => createMenuItemCard(item)).join('')}
                </div>
            `;
            menuItemsContainer.appendChild(categoryDiv);
        }
    });
    
    // Add event listeners to menu item cards
    document.querySelectorAll('.menu-item-card').forEach(card => {
        card.addEventListener('click', function() {
            const itemId = parseInt(this.dataset.itemId);
            toggleMenuItemSelection(itemId);
        });
    });
    
    // Add event listeners to quantity buttons
    document.querySelectorAll('.quantity-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const itemId = parseInt(this.closest('.menu-item-card').dataset.itemId);
            const action = this.classList.contains('increase') ? 'increase' : 'decrease';
            updateItemQuantity(itemId, action);
        });
    });
    
    // Add event listeners to quantity inputs
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', function(e) {
            e.stopPropagation();
            const itemId = parseInt(this.closest('.menu-item-card').dataset.itemId);
            const quantity = parseInt(this.value) || 0;
            updateItemQuantityDirect(itemId, quantity);
        });
    });
}

function getCategoryName(category) {
    const names = {
        'starters': 'Starters',
        'main-course': 'Main Course',
        'desserts': 'Desserts',
        'beverages': 'Beverages'
    };
    return names[category] || category;
}

function createMenuItemCard(item) {
    const selectedItem = selectedItems.find(i => i.id === item.id);
    const quantity = selectedItem ? selectedItem.quantity : 0;
    
    return `
        <div class="col-md-4 col-lg-3">
            <div class="menu-item-card ${quantity > 0 ? 'selected' : ''}" data-item-id="${item.id}">
                <div>
                    <div class="menu-item-name">${item.name}</div>
                    <small class="text-muted d-block mb-2">${item.description}</small>
                    <div class="menu-item-price">₹${item.price}</div>
                </div>
                <div class="menu-item-quantity">
                    <button class="quantity-btn decrease" ${quantity === 0 ? 'disabled' : ''}>
                        <i class="bi bi-dash"></i>
                    </button>
                    <input type="number" class="quantity-input" value="${quantity}" min="0">
                    <button class="quantity-btn increase">
                        <i class="bi bi-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ==================== ORDER HANDLING ====================
function initOrderHandling() {
    // Clear order button
    clearOrderBtn.addEventListener('click', function() {
        clearOrder();
    });
    
    // Place order button
    placeOrderBtn.addEventListener('click', function() {
        placeOrder();
    });
    
    // Refresh orders button
    if (refreshOrdersBtn) {
        refreshOrdersBtn.addEventListener('click', function() {
            loadOngoingOrders();
        });
    }
}

function toggleMenuItemSelection(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    
    const existingIndex = selectedItems.findIndex(i => i.id === itemId);
    
    if (existingIndex === -1) {
        // Add new item
        selectedItems.push({
            ...item,
            quantity: 1
        });
    } else {
        // Remove item if quantity is 0
        if (selectedItems[existingIndex].quantity === 0) {
            selectedItems.splice(existingIndex, 1);
        }
    }
    
    updateOrderSummary();
    renderMenuItems();
}

function updateItemQuantity(itemId, action) {
    const itemIndex = selectedItems.findIndex(i => i.id === itemId);
    
    if (itemIndex === -1 && action === 'increase') {
        const item = menuItems.find(i => i.id === itemId);
        selectedItems.push({
            ...item,
            quantity: 1
        });
    } else if (itemIndex !== -1) {
        if (action === 'increase') {
            selectedItems[itemIndex].quantity++;
        } else if (action === 'decrease') {
            selectedItems[itemIndex].quantity--;
            if (selectedItems[itemIndex].quantity <= 0) {
                selectedItems.splice(itemIndex, 1);
            }
        }
    }
    
    updateOrderSummary();
    renderMenuItems();
}

function updateItemQuantityDirect(itemId, quantity) {
    const itemIndex = selectedItems.findIndex(i => i.id === itemId);
    
    if (quantity > 0) {
        if (itemIndex === -1) {
            const item = menuItems.find(i => i.id === itemId);
            selectedItems.push({
                ...item,
                quantity: quantity
            });
        } else {
            selectedItems[itemIndex].quantity = quantity;
        }
    } else if (itemIndex !== -1) {
        selectedItems.splice(itemIndex, 1);
    }
    
    updateOrderSummary();
    renderMenuItems();
}

function updateOrderSummary() {
    // Calculate totals
    let subtotal = 0;
    selectedItems.forEach(item => {
        subtotal += item.price * item.quantity;
    });
    
    const tax = subtotal * 0.05; // 5% tax
    const discount = 0; // No discount by default
    const total = subtotal + tax - discount;
    
    // Update display
    orderSubtotal.textContent = formatCurrency(subtotal);
    orderTax.textContent = formatCurrency(tax);
    orderTotal.textContent = formatCurrency(total);
    orderDiscount.textContent = formatCurrency(discount);
    
    // Update order items list
    updateOrderItemsList();
}

function updateOrderItemsList() {
    if (selectedItems.length === 0) {
        orderSummaryItems.innerHTML = `
            <div class="text-center py-3">
                <p class="text-muted mb-0">No items selected</p>
            </div>
        `;
        return;
    }
    
    let itemsHtml = '';
    selectedItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHtml += `
            <div class="summary-item">
                <span>${item.name} × ${item.quantity}</span>
                <span>${formatCurrency(itemTotal)}</span>
            </div>
        `;
    });
    
    orderSummaryItems.innerHTML = itemsHtml;
}

function clearOrder() {
    selectedItems = [];
    updateOrderSummary();
    renderMenuItems();
    updateOrderId();
    showToast('Order cleared successfully!', 'success');
}

function updateOrderId() {
    orderIdDisplay.textContent = `#${orderCounter.toString().padStart(3, '0')}`;
}

function placeOrder() {
    if (selectedItems.length === 0) {
        showToast('Please add items to the order', 'warning');
        return;
    }
    
    const customerName = document.getElementById('customer-name').value || 'Walk-in Customer';
    const orderType = document.getElementById('order-type').value;
    const specialInstructions = document.getElementById('special-instructions').value;
    const paymentMethod = document.getElementById('payment-method').value;
    
    // Calculate totals
    let subtotal = 0;
    selectedItems.forEach(item => {
        subtotal += item.price * item.quantity;
    });
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    
    // Create order object
    const order = {
        id: orderCounter.toString().padStart(3, '0'),
        customerName: customerName,
        orderType: orderType,
        items: selectedItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity
        })),
        subtotal: subtotal,
        tax: tax,
        total: total,
        paymentMethod: paymentMethod,
        paymentStatus: 'Paid',
        status: 'Preparing',
        specialInstructions: specialInstructions,
        orderTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        orderDate: new Date().toISOString().split('T')[0],
        estimatedTime: getEstimatedTime(15), // 15 minutes from now
        createdAt: new Date().toISOString()
    };
    
    // Add to ongoing orders
    ongoingOrders.push(order);
    localStorage.setItem('ongoingOrders', JSON.stringify(ongoingOrders));
    
    // Increment order counter
    orderCounter++;
    localStorage.setItem('orderCounter', orderCounter.toString());
    
    // Show success message
    showToast(`Order #${order.id} placed successfully!`, 'success');
    
    // Clear current order
    clearOrder();
    
    // Switch to ongoing orders tab
    document.querySelector('[data-tab="ongoing-orders"]').click();
}

function getEstimatedTime(minutesToAdd) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutesToAdd);
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ==================== ONGOING ORDERS ====================
function loadOngoingOrders() {
    ongoingOrders = JSON.parse(localStorage.getItem('ongoingOrders')) || [];
    
    if (ongoingOrders.length === 0) {
        ongoingOrdersBody.innerHTML = '';
        noOngoingOrders.style.display = 'block';
        return;
    }
    
    noOngoingOrders.style.display = 'none';
    
    let html = '';
    ongoingOrders.forEach(order => {
        const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const orderTypeClass = getOrderTypeClass(order.orderType);
        const statusClass = order.status === 'Ready' ? 'status-ready' : 'status-preparing';
        
        html += `
            <tr>
                <td>#${order.id}</td>
                <td>${order.customerName}</td>
                <td>
                    <span class="order-type-badge ${orderTypeClass}">
                        ${getOrderTypeName(order.orderType)}
                    </span>
                </td>
                <td>${itemsCount} items</td>
                <td>${formatCurrency(order.total)}</td>
                <td>
                    <span class="status-badge ${statusClass}">${order.status}</span>
                </td>
                <td>${order.orderTime}</td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary btn-sm view-order-btn" data-order-id="${order.id}">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-success btn-sm complete-order-btn" data-order-id="${order.id}">
                            ${order.status === 'Ready' ? 'Complete' : 'Ready'}
                        </button>
                        <button class="btn btn-outline-danger btn-sm delete-order-btn" data-order-id="${order.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    ongoingOrdersBody.innerHTML = html;
    
    // Add event listeners
    document.querySelectorAll('.view-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            showOrderDetails(orderId);
        });
    });
    
    document.querySelectorAll('.complete-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            updateOrderStatus(orderId);
        });
    });
    
    document.querySelectorAll('.delete-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            deleteOrder(orderId);
        });
    });
}

function getOrderTypeClass(type) {
    const classes = {
        'dinein': 'order-type-dinein',
        'takeaway': 'order-type-takeaway',
        'delivery': 'order-type-delivery'
    };
    return classes[type] || '';
}

function getOrderTypeName(type) {
    const names = {
        'dinein': 'Dine-in',
        'takeaway': 'Takeaway',
        'delivery': 'Delivery'
    };
    return names[type] || type;
}

function updateOrderStatus(orderId) {
    const orderIndex = ongoingOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;
    
    if (ongoingOrders[orderIndex].status === 'Preparing') {
        ongoingOrders[orderIndex].status = 'Ready';
        showToast(`Order #${orderId} is now ready!`, 'success');
    } else {
        // Move to completed orders
        const completedOrder = ongoingOrders[orderIndex];
        completedOrder.completedAt = new Date().toISOString();
        completedOrder.completedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        completedOrders.push(completedOrder);
        ongoingOrders.splice(orderIndex, 1);
        
        localStorage.setItem('completedOrders', JSON.stringify(completedOrders));
        showToast(`Order #${orderId} completed!`, 'success');
    }
    
    localStorage.setItem('ongoingOrders', JSON.stringify(ongoingOrders));
    loadOngoingOrders();
    loadAnalytics();
}

function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    const orderIndex = ongoingOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;
    
    ongoingOrders.splice(orderIndex, 1);
    localStorage.setItem('ongoingOrders', JSON.stringify(ongoingOrders));
    
    showToast(`Order #${orderId} deleted!`, 'warning');
    loadOngoingOrders();
}

// ==================== COMPLETED ORDERS ====================
function loadCompletedOrders() {
    completedOrders = JSON.parse(localStorage.getItem('completedOrders')) || [];
    
    // Apply date filter if set
    let filteredOrders = filterOrdersByDate(completedOrders, 'completed');
    
    if (filteredOrders.length === 0) {
        completedOrdersBody.innerHTML = '';
        noCompletedOrders.style.display = 'block';
        return;
    }
    
    noCompletedOrders.style.display = 'none';
    
    let html = '';
    filteredOrders.forEach(order => {
        const orderTypeClass = getOrderTypeClass(order.orderType);
        
        html += `
            <tr>
                <td>#${order.id}</td>
                <td>${order.customerName}</td>
                <td>
                    <span class="order-type-badge ${orderTypeClass}">
                        ${getOrderTypeName(order.orderType)}
                    </span>
                </td>
                <td>${order.completedTime || order.orderTime} ${order.completedAt || order.orderDate}</td>
                <td>${formatCurrency(order.total)}</td>
                <td>${order.paymentMethod}</td>
                <td>
                    <span class="badge bg-success">Completed</span>
                </td>
            </tr>
        `;
    });
    
    completedOrdersBody.innerHTML = html;
}

// ==================== ORDER DETAILS MODAL ====================
function initOrderDetailsModal() {
    // Event listener for view buttons is added in loadOngoingOrders()
}

function showOrderDetails(orderId) {
    const order = ongoingOrders.find(o => o.id === orderId);
    if (!order) {
        showToast('Order not found', 'error');
        return;
    }
    
    // Populate modal
    document.getElementById('modalOrderId').textContent = `#${order.id}`;
    document.getElementById('modalCustomerName').textContent = order.customerName;
    document.getElementById('modalOrderType').textContent = getOrderTypeName(order.orderType);
    document.getElementById('modalOrderTime').textContent = order.orderTime;
    document.getElementById('modalOrderDate').textContent = order.orderDate;
    document.getElementById('modalEstimatedTime').textContent = order.estimatedTime;
    document.getElementById('modalPaymentMethod').textContent = order.paymentMethod;
    document.getElementById('modalSpecialInstructions').textContent = order.specialInstructions || 'No special instructions';
    
    // Update status badge
    const statusBadge = document.getElementById('modalOrderStatus');
    statusBadge.textContent = order.status;
    statusBadge.className = 'badge ' + (order.status === 'Ready' ? 'bg-success' : 'bg-warning');
    
    // Update payment badge
    const paymentBadge = document.getElementById('modalPaymentStatus');
    paymentBadge.textContent = order.paymentStatus;
    paymentBadge.className = 'badge ' + (order.paymentStatus === 'Paid' ? 'bg-success' : 'bg-warning');
    
    // Update financials
    document.getElementById('modalSubtotal').textContent = formatCurrency(order.subtotal);
    document.getElementById('modalTax').textContent = formatCurrency(order.tax);
    document.getElementById('modalTotal').textContent = formatCurrency(order.total);
    
    // Update order items
    const itemsTable = document.getElementById('modalOrderItems');
    itemsTable.innerHTML = '';
    
    order.items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.total)}</td>
        `;
        itemsTable.appendChild(row);
    });
    
    // Update mark as complete button
    const completeBtn = document.getElementById('markAsCompleteBtn');
    if (order.status === 'Ready') {
        completeBtn.textContent = 'Mark as Complete';
        completeBtn.classList.remove('btn-success');
        completeBtn.classList.add('btn-primary');
    } else {
        completeBtn.textContent = 'Mark as Ready';
        completeBtn.classList.remove('btn-primary');
        completeBtn.classList.add('btn-success');
    }
    
    // Set click handler
    completeBtn.onclick = function() {
        updateOrderStatus(order.id);
        bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal')).hide();
    };
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    modal.show();
}

// ==================== DATE FILTERS ====================
function initDateFilters() {
    // Set default dates (today and max 2 years back)
    const today = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(today.getFullYear() - 2);
    
    // Format dates for input fields
    const formatDateForInput = (date) => {
        return date.toISOString().split('T')[0];
    };
    
    // Initialize all date inputs
    const dateInputs = [
        { element: analyticsStartDate, type: 'analytics' },
        { element: analyticsEndDate, type: 'analytics' },
        { element: completedStartDate, type: 'completed' },
        { element: completedEndDate, type: 'completed' }
    ];
    
    dateInputs.forEach(input => {
        if (input.element) {
            // Set default values (today)
            input.element.value = formatDateForInput(today);
            
            // Set min/max dates
            input.element.min = formatDateForInput(twoYearsAgo);
            input.element.max = formatDateForInput(today);
        }
    });
    
    // Add event listeners for date range validation
    analyticsStartDate?.addEventListener('change', function() {
        analyticsEndDate.min = this.value;
        if (new Date(analyticsEndDate.value) < new Date(this.value)) {
            analyticsEndDate.value = this.value;
        }
    });
    
    analyticsEndDate?.addEventListener('change', function() {
        analyticsStartDate.max = this.value;
        if (new Date(analyticsStartDate.value) > new Date(this.value)) {
            analyticsStartDate.value = this.value;
        }
    });
    
    completedStartDate?.addEventListener('change', function() {
        completedEndDate.min = this.value;
        if (new Date(completedEndDate.value) < new Date(this.value)) {
            completedEndDate.value = this.value;
        }
    });
    
    completedEndDate?.addEventListener('change', function() {
        completedStartDate.max = this.value;
        if (new Date(completedStartDate.value) > new Date(this.value)) {
            completedStartDate.value = this.value;
        }
    });
    
    // Apply filter buttons
    applyAnalyticsFilter?.addEventListener('click', function() {
        loadAnalytics();
    });
    
    applyCompletedFilter?.addEventListener('click', function() {
        loadCompletedOrders();
    });
    
    // Quick date range buttons
    document.querySelectorAll('.quick-date-range').forEach(button => {
        button.addEventListener('click', function() {
            const range = this.dataset.range;
            const tab = this.closest('.tab-content').id;
            setQuickDateRange(range, tab);
        });
    });
}

function setQuickDateRange(range, tab) {
    const today = new Date();
    let startDate = new Date();
    
    switch (range) {
        case 'today':
            startDate = new Date(today);
            break;
        case 'yesterday':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 1);
            break;
        case 'week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 1);
            break;
        case 'year':
            startDate = new Date(today);
            startDate.setFullYear(today.getFullYear() - 1);
            break;
    }
    
    const formatDateForInput = (date) => {
        return date.toISOString().split('T')[0];
    };
    
    if (tab === 'analytics' || tab === 'completed-orders') {
        const startElement = tab === 'analytics' ? analyticsStartDate : completedStartDate;
        const endElement = tab === 'analytics' ? analyticsEndDate : completedEndDate;
        
        if (startElement && endElement) {
            startElement.value = formatDateForInput(startDate);
            endElement.value = formatDateForInput(today);
            
            // Trigger filter update
            if (tab === 'analytics') {
                loadAnalytics();
            } else {
                loadCompletedOrders();
            }
            
            showToast(`Filter set to: ${range}`, 'success');
        }
    }
}

function filterOrdersByDate(orders, type) {
    let startDate, endDate;
    
    if (type === 'analytics') {
        startDate = analyticsStartDate ? new Date(analyticsStartDate.value) : null;
        endDate = analyticsEndDate ? new Date(analyticsEndDate.value) : null;
    } else {
        startDate = completedStartDate ? new Date(completedStartDate.value) : null;
        endDate = completedEndDate ? new Date(completedEndDate.value) : null;
    }
    
    if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
        return orders;
    }
    
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
    
    return orders.filter(order => {
        const orderDate = new Date(order.completedAt || order.createdAt || order.orderDate);
        return orderDate >= startDate && orderDate <= endDate;
    });
}

// ==================== ANALYTICS ====================
function loadAnalytics() {
    completedOrders = JSON.parse(localStorage.getItem('completedOrders')) || [];
    
    // Apply date filter
    let filteredOrders = filterOrdersByDate(completedOrders, 'analytics');
    
    // Calculate statistics
    const totalRevenueValue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrdersValue = filteredOrders.length;
    const averageOrderValueValue = totalOrdersValue > 0 ? totalRevenueValue / totalOrdersValue : 0;
    
    // Find most popular item
    const itemCounts = {};
    filteredOrders.forEach(order => {
        order.items.forEach(item => {
            if (!itemCounts[item.name]) {
                itemCounts[item.name] = 0;
            }
            itemCounts[item.name] += item.quantity;
        });
    });
    
    let mostPopularItemName = '-';
    let maxCount = 0;
    for (const [itemName, count] of Object.entries(itemCounts)) {
        if (count > maxCount) {
            maxCount = count;
            mostPopularItemName = itemName;
        }
    }
    
    // Update display
    totalRevenue.textContent = formatCurrency(totalRevenueValue);
    totalOrders.textContent = totalOrdersValue;
    averageOrderValue.textContent = formatCurrency(averageOrderValueValue);
    mostPopularItem.textContent = mostPopularItemName;
    
    // Update charts
    updateCharts(filteredOrders);
    
    // Update recent orders
    updateRecentOrders(filteredOrders);
    
    // Update business profile stats
    updateBusinessStats();
}

function updateCharts(orders) {
    // Destroy existing charts
    if (revenueChart) {
        revenueChart.destroy();
    }
    if (orderTypeChart) {
        orderTypeChart.destroy();
    }
    
    // Revenue trend (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }
    
    const revenueByDay = last7Days.map(date => {
        const dayOrders = orders.filter(order => {
            const orderDate = new Date(order.completedAt || order.createdAt).toISOString().split('T')[0];
            return orderDate === date;
        });
        return dayOrders.reduce((sum, order) => sum + order.total, 0);
    });
    
    // Revenue Chart
    const revenueCtx = document.getElementById('revenue-chart').getContext('2d');
    revenueChart = new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: last7Days.map(date => new Date(date).toLocaleDateString('en-IN', { weekday: 'short' })),
            datasets: [{
                label: 'Revenue (₹)',
                data: revenueByDay,
                borderColor: '#ff6b35',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value;
                        }
                    }
                }
            }
        }
    });
    
    // Order type distribution
    const orderTypes = ['dinein', 'takeaway', 'delivery'];
    const orderTypeCounts = orderTypes.map(type => 
        orders.filter(order => order.orderType === type).length
    );
    
    // Order Type Chart
    const orderTypeCtx = document.getElementById('order-type-chart').getContext('2d');
    orderTypeChart = new Chart(orderTypeCtx, {
        type: 'doughnut',
        data: {
            labels: ['Dine-in', 'Takeaway', 'Delivery'],
            datasets: [{
                data: orderTypeCounts,
                backgroundColor: [
                    '#3498db',
                    '#2ecc71',
                    '#e74c3c'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateRecentOrders(orders) {
    // Get 5 most recent orders
    const recentOrders = [...orders]
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
        .slice(0, 5);
    
    let html = '';
    recentOrders.forEach(order => {
        html += `
            <tr>
                <td>#${order.id}</td>
                <td>${order.customerName}</td>
                <td>${formatCurrency(order.total)}</td>
                <td>
                    <span class="badge bg-success">Completed</span>
                </td>
                <td>${order.completedTime || order.orderTime}</td>
            </tr>
        `;
    });
    
    if (recentOrdersBody) {
        recentOrdersBody.innerHTML = html || '<tr><td colspan="5" class="text-center">No recent orders</td></tr>';
    }
}

function updateBusinessStats() {
    const allOrders = JSON.parse(localStorage.getItem('completedOrders')) || [];
    const totalOrdersCount = allOrders.length;
    const totalRevenueValue = allOrders.reduce((sum, order) => sum + order.total, 0);
    const totalProfit = totalRevenueValue * 0.7; // Assuming 30% profit margin
    
    // Update profile stats
    document.getElementById('total-business-orders').textContent = totalOrdersCount;
    document.getElementById('total-business-revenue').textContent = formatCurrency(totalRevenueValue);
    document.getElementById('total-business-profit').textContent = formatCurrency(totalProfit);
}

// ==================== BUSINESS PROFILE ====================
function initBusinessProfile() {
    const profileForm = document.getElementById('business-profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            showToast('Profile updated successfully!', 'success');
        });
    }
}

// ==================== UTILITY FUNCTIONS ====================
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function showLoading() {
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

function showToast(message, type = 'success') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-container .toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast show`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    const bgClass = type === 'success' ? 'bg-success' : 
                    type === 'error' ? 'bg-danger' : 
                    type === 'warning' ? 'bg-warning' : 'bg-primary';
    
    toast.innerHTML = `
        <div class="toast-header ${bgClass} text-white">
            <strong class="me-auto">
                ${type === 'success' ? 'Success!' : 
                  type === 'error' ? 'Error!' : 
                  type === 'warning' ? 'Warning!' : 'Info!'}
            </strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Add to toast container
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    container.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Initialize toast container CSS
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    .toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
    }
    .toast {
        min-width: 300px;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
`;
document.head.appendChild(toastStyle);

// ==================== OFFLINE DETECTION ====================
window.addEventListener('online', function() {
    showToast('Back online!', 'success');
});

window.addEventListener('offline', function() {
    showToast('You are offline. Some features may not work.', 'warning');
});

// Initialize service worker for offline functionality
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(error => {
        console.log('ServiceWorker registration failed:', error);
    });
}
