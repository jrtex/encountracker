// UI Components Library
const Components = {
  // Toast Notifications
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // Modal
  showModal(title, content, actions = []) {
    const container = document.getElementById('modal-container');

    // Clear any existing modals to prevent ID conflicts
    container.innerHTML = '';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const actionsHTML = actions.map(action =>
      `<button type="button" class="btn ${action.class || 'btn-primary'}" data-action="${action.id}">${action.label}</button>`
    ).join('');

    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${actions.length ? `<div class="modal-footer">${actionsHTML}</div>` : ''}
      </div>
    `;

    container.appendChild(modal);

    // Close button handler
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });

    // Overlay click to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Action button handlers
    actions.forEach(action => {
      const btn = modal.querySelector(`[data-action="${action.id}"]`);
      if (btn && action.handler) {
        btn.addEventListener('click', () => {
          action.handler();
          if (action.closeOnClick !== false) {
            modal.remove();
          }
        });
      }
    });

    return modal;
  },

  // Confirm Dialog
  confirm(message, onConfirm) {
    // If onConfirm callback is provided, use legacy callback-based behavior
    if (onConfirm) {
      return this.showModal(
        'Confirm',
        `<p>${message}</p>`,
        [
          {
            id: 'cancel',
            label: 'Cancel',
            class: 'btn-secondary'
          },
          {
            id: 'confirm',
            label: 'Confirm',
            class: 'btn-danger',
            handler: onConfirm
          }
        ]
      );
    }

    // Promise-based behavior for await/async usage
    return new Promise((resolve) => {
      this.showModal(
        'Confirm',
        `<p>${message}</p>`,
        [
          {
            id: 'cancel',
            label: 'Cancel',
            class: 'btn-secondary',
            handler: () => resolve(false)
          },
          {
            id: 'confirm',
            label: 'Confirm',
            class: 'btn-danger',
            handler: () => resolve(true)
          }
        ]
      );
    });
  },

  // Loading Spinner
  showSpinner(container, size = '') {
    const spinner = document.createElement('div');
    spinner.className = `spinner ${size}`;
    spinner.id = 'loading-spinner';
    container.appendChild(spinner);
    return spinner;
  },

  hideSpinner(container) {
    const spinner = container.querySelector('#loading-spinner');
    if (spinner) {
      spinner.remove();
    }
  },

  // Create Table
  createTable(headers, rows, options = {}) {
    const table = document.createElement('table');
    table.className = `table ${options.striped ? 'table-striped' : ''}`;

    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        if (typeof cell === 'string') {
          td.textContent = cell;
        } else {
          td.innerHTML = cell;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  },

  // Create Card
  createCard(title, content, footer = null) {
    const card = document.createElement('div');
    card.className = 'card';

    if (title) {
      const header = document.createElement('div');
      header.className = 'card-header';
      header.innerHTML = `<h3>${title}</h3>`;
      card.appendChild(header);
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }
    card.appendChild(body);

    if (footer) {
      const footerEl = document.createElement('div');
      footerEl.className = 'card-footer';
      if (typeof footer === 'string') {
        footerEl.innerHTML = footer;
      } else {
        footerEl.appendChild(footer);
      }
      card.appendChild(footerEl);
    }

    return card;
  },

  // Create Badge
  createBadge(text, type = 'primary') {
    const badge = document.createElement('span');
    badge.className = `badge badge-${type}`;
    badge.textContent = text;
    return badge;
  },

  // Create Alert
  createAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    return alert;
  }
};
