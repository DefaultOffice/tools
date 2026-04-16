(function(global) {
  'use strict';

  let styleInjected = false;
  let activeInstance = null;

  /* ── Utilities ─────────────────────────────────────────── */

  function formatTimestamp() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return yy + mm + dd + '_' + hh + mi + ss;
  }

  function padFrame(n) {
    return String(n).padStart(5, '0');
  }

  function buildFrameName(opts, frameIndex) {
    const parts = [opts.name];
    if (opts.suffix) parts.push(opts.suffix);
    if (opts.timestamp) parts.push(opts.timestamp);
    parts.push(padFrame(frameIndex));
    return parts.join('_') + '.' + (opts.extension || 'png');
  }

  function buildZipName(opts) {
    const parts = [opts.name];
    if (opts.timestamp) parts.push(opts.timestamp);
    if (opts.metadata) parts.push(opts.metadata);
    return parts.join('_') + '.zip';
  }

  /* ── CSS injection ─────────────────────────────────────── */

  function injectStyles() {
    const css = `
[data-export-dialog] {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.75);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 11px;
  color: #fff;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
[data-export-dialog] *, [data-export-dialog] *::before, [data-export-dialog] *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
[data-export-dialog] .exd-modal {
  background: #0d0d0d;
  border: 1px solid #333;
  padding: 24px;
  width: 380px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}
[data-export-dialog] .exd-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: #fff;
  margin-bottom: 20px;
}
[data-export-dialog] .exd-divider {
  height: 1px;
  background: #333;
  margin: 16px 0;
}
[data-export-dialog] .exd-row {
  display: flex;
  align-items: center;
  min-height: 30px;
  gap: 12px;
}
[data-export-dialog] .exd-row + .exd-row {
  margin-top: 6px;
}
[data-export-dialog] .exd-label {
  width: 100px;
  flex-shrink: 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #999;
}
[data-export-dialog] .exd-value {
  color: #ccc;
  font-size: 11px;
}
[data-export-dialog] .exd-input {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  font-family: inherit;
  font-size: 11px;
  padding: 6px 8px;
  outline: none;
  min-width: 0;
}
[data-export-dialog] .exd-input:focus {
  border-color: #FF4F00;
}
[data-export-dialog] .exd-select {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  font-family: inherit;
  font-size: 11px;
  padding: 5px 6px;
  outline: none;
  cursor: pointer;
  min-width: 0;
}
[data-export-dialog] .exd-select:focus {
  border-color: #FF4F00;
}
[data-export-dialog] .exd-color-input {
  width: 32px;
  height: 26px;
  border: 1px solid #333;
  background: none;
  padding: 0;
  cursor: pointer;
}
[data-export-dialog] .exd-checkbox-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
[data-export-dialog] .exd-checkbox {
  width: 14px;
  height: 14px;
  accent-color: #FF4F00;
  cursor: pointer;
}
[data-export-dialog] .exd-timestamp-preview {
  color: #666;
  font-size: 10px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
}
[data-export-dialog] .exd-preview-row {
  margin-top: 12px;
}
[data-export-dialog] .exd-preview-value {
  color: #FF4F00;
  font-size: 10px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  word-break: break-all;
}
[data-export-dialog] .exd-progress {
  display: none;
  margin-top: 16px;
}
[data-export-dialog] .exd-progress.active {
  display: block;
}
[data-export-dialog] .exd-progress-bar {
  width: 100%;
  height: 2px;
  background: #333;
  overflow: hidden;
}
[data-export-dialog] .exd-progress-fill {
  height: 100%;
  background: #FF4F00;
  width: 0%;
  transition: width .1s;
}
[data-export-dialog] .exd-progress-text {
  display: block;
  margin-top: 8px;
  font-size: 10px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: .06em;
}
[data-export-dialog] .exd-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}
[data-export-dialog] .exd-btn {
  font-family: inherit;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .08em;
  padding: 8px 18px;
  border: 1px solid #333;
  background: none;
  color: #999;
  cursor: pointer;
  transition: all .15s;
}
[data-export-dialog] .exd-btn:hover {
  border-color: #666;
  color: #fff;
}
[data-export-dialog] .exd-btn.exd-export {
  background: #FF4F00;
  border-color: #FF4F00;
  color: #fff;
}
[data-export-dialog] .exd-btn.exd-export:hover {
  opacity: .85;
}
[data-export-dialog] .exd-btn:disabled {
  opacity: .4;
  cursor: default;
}
[data-export-dialog] .exd-hidden {
  display: none !important;
}
`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ── Dialog Instance ───────────────────────────────────── */

  class DialogInstance {
    constructor(config, resolve) {
      this.config = config;
      this.resolve = resolve;
      this.cancelled = false;
      this.exporting = false;
      this.el = null;
      this.timestamp = formatTimestamp();
      this._build();
      this._bind();
    }

    _build() {
      const c = this.config;
      const root = document.createElement('div');
      root.setAttribute('data-export-dialog', '');
      this.el = root;

      const modal = document.createElement('div');
      modal.className = 'exd-modal';
      root.appendChild(modal);

      // Title
      const title = document.createElement('div');
      title.className = 'exd-title';
      title.textContent = 'Export Sequence';
      modal.appendChild(title);

      // Info rows
      if (c.info && c.info.length) {
        const section = document.createElement('div');
        c.info.forEach(item => {
          const row = document.createElement('div');
          row.className = 'exd-row';
          row.innerHTML = '<span class="exd-label">' + item.label + '</span><span class="exd-value">' + item.value + '</span>';
          section.appendChild(row);
        });
        modal.appendChild(section);
        modal.appendChild(this._divider());
      }

      // Naming section
      const naming = document.createElement('div');

      // Name input
      const nameRow = document.createElement('div');
      nameRow.className = 'exd-row';
      const nameLabel = document.createElement('span');
      nameLabel.className = 'exd-label';
      nameLabel.textContent = 'Name';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'exd-input';
      nameInput.value = c.toolName || '';
      nameInput.spellcheck = false;
      this._nameInput = nameInput;
      nameRow.appendChild(nameLabel);
      nameRow.appendChild(nameInput);
      naming.appendChild(nameRow);

      // Timestamp toggle
      const tsRow = document.createElement('div');
      tsRow.className = 'exd-row';
      const tsLabel = document.createElement('span');
      tsLabel.className = 'exd-label';
      tsLabel.textContent = 'Timestamp';
      const tsWrap = document.createElement('div');
      tsWrap.className = 'exd-checkbox-wrap';
      const tsCheck = document.createElement('input');
      tsCheck.type = 'checkbox';
      tsCheck.className = 'exd-checkbox';
      tsCheck.checked = true;
      this._tsCheck = tsCheck;
      const tsPreview = document.createElement('span');
      tsPreview.className = 'exd-timestamp-preview';
      tsPreview.textContent = this.timestamp;
      this._tsPreview = tsPreview;
      tsWrap.appendChild(tsCheck);
      tsWrap.appendChild(tsPreview);
      tsRow.appendChild(tsLabel);
      tsRow.appendChild(tsWrap);
      naming.appendChild(tsRow);

      // Frame name preview
      const previewRow = document.createElement('div');
      previewRow.className = 'exd-row exd-preview-row';
      const previewLabel = document.createElement('span');
      previewLabel.className = 'exd-label';
      previewLabel.textContent = 'Preview';
      const previewValue = document.createElement('span');
      previewValue.className = 'exd-preview-value';
      this._previewValue = previewValue;
      previewRow.appendChild(previewLabel);
      previewRow.appendChild(previewValue);
      naming.appendChild(previewRow);

      modal.appendChild(naming);

      // Custom fields
      this._fieldEls = {};
      this._linkedFieldEls = {};
      if (c.fields && c.fields.length) {
        modal.appendChild(this._divider());
        const custom = document.createElement('div');
        c.fields.forEach(field => {
          this._buildField(field, custom);
        });
        modal.appendChild(custom);
      }

      // Progress
      const prog = document.createElement('div');
      prog.className = 'exd-progress';
      this._progress = prog;
      const progBar = document.createElement('div');
      progBar.className = 'exd-progress-bar';
      const progFill = document.createElement('div');
      progFill.className = 'exd-progress-fill';
      this._progressFill = progFill;
      progBar.appendChild(progFill);
      prog.appendChild(progBar);
      const progText = document.createElement('span');
      progText.className = 'exd-progress-text';
      this._progressText = progText;
      prog.appendChild(progText);
      modal.appendChild(prog);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'exd-footer';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'exd-btn exd-cancel';
      cancelBtn.textContent = 'Cancel';
      this._cancelBtn = cancelBtn;
      const exportBtn = document.createElement('button');
      exportBtn.className = 'exd-btn exd-export';
      exportBtn.textContent = 'Export';
      this._exportBtn = exportBtn;
      footer.appendChild(cancelBtn);
      footer.appendChild(exportBtn);
      modal.appendChild(footer);

      document.body.appendChild(root);
      this._updatePreview();
    }

    _divider() {
      const d = document.createElement('div');
      d.className = 'exd-divider';
      return d;
    }

    _buildField(field, container) {
      const row = document.createElement('div');
      row.className = 'exd-row';
      const label = document.createElement('span');
      label.className = 'exd-label';
      label.textContent = field.label;
      row.appendChild(label);

      if (field.type === 'select') {
        const select = document.createElement('select');
        select.className = 'exd-select';
        (field.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (opt.value === field.default) o.selected = true;
          select.appendChild(o);
        });
        this._fieldEls[field.id] = select;
        row.appendChild(select);

        // Linked fields support
        if (field.linkedFields) {
          select.addEventListener('change', () => this._updateLinkedFields(field));
          this._linkedFieldEls[field.id] = {};
          container.appendChild(row);
          // Build linked field rows (initially hidden)
          Object.keys(field.linkedFields).forEach(triggerValue => {
            field.linkedFields[triggerValue].forEach(lf => {
              const lRow = document.createElement('div');
              lRow.className = 'exd-row exd-hidden';
              const lLabel = document.createElement('span');
              lLabel.className = 'exd-label';
              lLabel.textContent = lf.label;
              lRow.appendChild(lLabel);
              const input = this._buildFieldInput(lf);
              lRow.appendChild(input);
              this._fieldEls[lf.id] = input;
              if (!this._linkedFieldEls[field.id][triggerValue]) {
                this._linkedFieldEls[field.id][triggerValue] = [];
              }
              this._linkedFieldEls[field.id][triggerValue].push(lRow);
              container.appendChild(lRow);
            });
          });
          this._updateLinkedFields(field);
          return;
        }
      } else {
        const input = this._buildFieldInput(field);
        row.appendChild(input);
        this._fieldEls[field.id] = input;
      }

      container.appendChild(row);
    }

    _buildFieldInput(field) {
      if (field.type === 'checkbox') {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'exd-checkbox';
        cb.checked = !!field.default;
        return cb;
      } else if (field.type === 'color') {
        const ci = document.createElement('input');
        ci.type = 'color';
        ci.className = 'exd-color-input';
        ci.value = field.default || '#000000';
        return ci;
      } else if (field.type === 'number') {
        const ni = document.createElement('input');
        ni.type = 'number';
        ni.className = 'exd-input';
        if (field.min !== undefined) ni.min = field.min;
        if (field.max !== undefined) ni.max = field.max;
        if (field.step !== undefined) ni.step = field.step;
        ni.value = field.default || '';
        return ni;
      } else {
        const ti = document.createElement('input');
        ti.type = 'text';
        ti.className = 'exd-input';
        ti.value = field.default || '';
        return ti;
      }
    }

    _updateLinkedFields(field) {
      const currentVal = this._fieldEls[field.id].value;
      const groups = this._linkedFieldEls[field.id];
      Object.keys(groups).forEach(triggerValue => {
        groups[triggerValue].forEach(row => {
          if (currentVal === triggerValue) {
            row.classList.remove('exd-hidden');
          } else {
            row.classList.add('exd-hidden');
          }
        });
      });
    }

    _updatePreview() {
      const name = this._nameInput.value.trim() || 'export';
      const ts = this._tsCheck.checked ? this.timestamp : null;
      const preview = buildFrameName({ name: name, timestamp: ts, extension: this._getExtension() }, 1);
      this._previewValue.textContent = preview;
    }

    _getExtension() {
      // Check if there's a format field that determines extension
      if (this._fieldEls['format']) {
        const val = this._fieldEls['format'].value;
        if (val === 'jpg' || val === 'jpeg') return 'jpg';
      }
      return 'png';
    }

    _collectValues() {
      const customValues = {};
      Object.keys(this._fieldEls).forEach(id => {
        const el = this._fieldEls[id];
        if (el.type === 'checkbox') {
          customValues[id] = el.checked;
        } else {
          customValues[id] = el.value;
        }
      });
      return {
        name: this._nameInput.value.trim() || 'export',
        timestamp: this._tsCheck.checked ? this.timestamp : null,
        extension: this._getExtension(),
        customValues: customValues,
        cancelled: false
      };
    }

    _bind() {
      this._nameInput.addEventListener('input', () => this._updatePreview());
      this._tsCheck.addEventListener('change', () => {
        this._tsPreview.style.opacity = this._tsCheck.checked ? '1' : '.3';
        this._updatePreview();
      });

      // Update preview when format changes
      if (this._fieldEls['format']) {
        this._fieldEls['format'].addEventListener('change', () => this._updatePreview());
      }

      this._exportBtn.addEventListener('click', () => this._onExport());
      this._cancelBtn.addEventListener('click', () => this._onCancel());

      // Close on backdrop click
      this.el.addEventListener('click', (e) => {
        if (e.target === this.el && !this.exporting) this._onCancel();
      });

      // Close on Escape
      this._escHandler = (e) => {
        if (e.key === 'Escape' && !this.exporting) this._onCancel();
      };
      document.addEventListener('keydown', this._escHandler);
    }

    _onExport() {
      if (this.exporting) return;
      this.exporting = true;
      this.timestamp = formatTimestamp(); // capture at export time
      this._updatePreview();
      this._exportBtn.disabled = true;
      this._exportBtn.textContent = 'Exporting\u2026';
      this._nameInput.disabled = true;
      this._tsCheck.disabled = true;
      Object.values(this._fieldEls).forEach(el => { el.disabled = true; });
      this._progress.classList.add('active');
      this.resolve(this._collectValues());
    }

    _onCancel() {
      if (this.exporting) {
        this.cancelled = true;
        this._cancelBtn.disabled = true;
        this._cancelBtn.textContent = 'Cancelling\u2026';
        return;
      }
      this.resolve({ cancelled: true });
      this.destroy();
    }

    progress(current, total, text) {
      const pct = total > 0 ? (current / total * 100) : 0;
      this._progressFill.style.width = pct + '%';
      this._progressText.textContent = text || ('Exporting ' + current + ' / ' + total);
    }

    complete() {
      this.destroy();
    }

    destroy() {
      document.removeEventListener('keydown', this._escHandler);
      if (this.el && this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
      this.el = null;
    }
  }

  /* ── Public API ────────────────────────────────────────── */

  global.ExportDialog = {
    show: function(config) {
      if (!styleInjected) { injectStyles(); styleInjected = true; }
      if (activeInstance) { activeInstance.destroy(); activeInstance = null; }
      return new Promise(function(resolve) {
        activeInstance = new DialogInstance(config, resolve);
      });
    },

    frameName: function(opts, frameIndex) {
      return buildFrameName(opts, frameIndex);
    },

    zipName: function(opts) {
      return buildZipName(opts);
    },

    progress: function(current, total, text) {
      if (activeInstance) activeInstance.progress(current, total, text);
    },

    isCancelled: function() {
      return activeInstance ? activeInstance.cancelled : false;
    },

    complete: function() {
      if (activeInstance) { activeInstance.complete(); activeInstance = null; }
    }
  };

})(window);
