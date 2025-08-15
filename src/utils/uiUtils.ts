/**
 * UI Utilities Module
 * Handles notifications and other UI-related functionality
 */

export type NotificationType = 'success' | 'error' | 'warning';

export function showNotification(message: string, type: NotificationType = 'success'): void {
  // Create a temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 4px;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 10000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
  `;

  const colors = {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B'
  };

  notification.style.backgroundColor = colors[type];
  notification.textContent = message;

  // Add animation keyframes if not already added
  if (!document.querySelector('#linkedin-scraper-styles')) {
    const style = document.createElement('style');
    style.id = 'linkedin-scraper-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}
