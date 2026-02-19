import { Dialog, Disclosure, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';
import type { OptimiseSettings, RunMode } from '@/shared/types';

interface SettingsDialogProps {
  open: boolean;
  runMode: RunMode;
  settings: OptimiseSettings;
  onClose: () => void;
  onChange: (next: OptimiseSettings) => void;
}

function set<K extends keyof OptimiseSettings>(settings: OptimiseSettings, onChange: (next: OptimiseSettings) => void, key: K, value: OptimiseSettings[K]) {
  onChange({ ...settings, [key]: value });
}

/* ── Reusable row components ──────────────────────────────────── */

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <div className="settings-row-control">
        <label className="macos-toggle">
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          <span className="toggle-track" />
          <span className="toggle-thumb" />
        </label>
      </div>
    </div>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <div className="settings-row-control">
        <select className="macos-select-mode" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, hint, onChange }: { label: string; value: number; min: number; max: number; hint?: string; onChange: (v: number) => void }) {
  const fill = ((value - min) / (max - min)) * 100;

  return (
    <div className="settings-slider-row">
      <div className="settings-slider-header">
        <span className="settings-slider-label">{label}</span>
        <span className="settings-slider-value">{value}</span>
      </div>
      <input
        type="range"
        className="settings-slider-track"
        min={min}
        max={max}
        value={value}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="settings-slider-hint">{hint}</span>}
    </div>
  );
}

/* ── Tab panels ───────────────────────────────────────────────── */

function GeneralPanel({ settings, onChange }: { settings: OptimiseSettings; onChange: (s: OptimiseSettings) => void }) {
  return (
    <div>
      {/* Output mode */}
      <div className="settings-section-title">Output mode</div>
      <div className="settings-section">
        <div className="settings-row">
          <span className="settings-row-label">Optimized folder</span>
          <div className="settings-row-control">
            <input
              type="radio"
              name="outputMode"
              checked={settings.outputMode === 'subfolder'}
              onChange={() => set(settings, onChange, 'outputMode', 'subfolder')}
            />
          </div>
        </div>
        <div className="settings-row">
          <div>
            <span className="settings-row-label">Replace originals</span>
            {settings.outputMode === 'replace' && (
              <div className="settings-row-sublabel" style={{ color: 'var(--macos-orange)' }}>Backups are created before replacement</div>
            )}
          </div>
          <div className="settings-row-control">
            <input
              type="radio"
              name="outputMode"
              checked={settings.outputMode === 'replace'}
              onChange={() => set(settings, onChange, 'outputMode', 'replace')}
            />
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="settings-section-title">Export</div>
      <div className="settings-section">
        <SelectRow
          label="Preset"
          value={settings.exportPreset}
          options={[
            { value: 'original', label: 'Original' },
            { value: 'web', label: 'Web' },
            { value: 'design', label: 'Design (Figma/Framer)' },
          ]}
          onChange={(v) => set(settings, onChange, 'exportPreset', v as OptimiseSettings['exportPreset'])}
        />
        <div className="settings-row settings-row-stack">
          <span className="settings-row-label">Naming pattern</span>
          <input
            type="text"
            value={settings.namingPattern}
            onChange={(e) => set(settings, onChange, 'namingPattern', e.target.value)}
            placeholder="{name}"
            className="macos-input w-full"
          />
          <span className="settings-row-sublabel">{'{name} {ext} {width} {height} {scale} {format} {hash}'}</span>
        </div>
      </div>

      {/* Options */}
      <div className="settings-section-title">Options</div>
      <div className="settings-section">
        <ToggleRow label="Keep metadata" checked={settings.keepMetadata} onChange={(v) => set(settings, onChange, 'keepMetadata', v)} />
        <ToggleRow label="Optimize clipboard images" checked={settings.optimizeClipboardImages} onChange={(v) => set(settings, onChange, 'optimizeClipboardImages', v)} />
        <ToggleRow label="Allow larger outputs" checked={settings.allowLargerOutput} onChange={(v) => set(settings, onChange, 'allowLargerOutput', v)} />
      </div>
    </div>
  );
}

function OptimizationPanel({ settings, onChange }: { settings: OptimiseSettings; onChange: (s: OptimiseSettings) => void }) {
  return (
    <div>
      <div className="settings-section-title">Quality</div>
      <div className="settings-section">
        <SliderRow
          label="JPEG quality"
          value={settings.jpegQuality}
          min={75}
          max={92}
          onChange={(v) => set(settings, onChange, 'jpegQuality', v)}
        />
      </div>

      <div className="settings-section-title">PNG</div>
      <div className="settings-section">
        <ToggleRow label="Aggressive (may change colors slightly)" checked={settings.aggressivePng} onChange={(v) => set(settings, onChange, 'aggressivePng', v)} />
      </div>
    </div>
  );
}

function WebPPanel({ settings, onChange }: { settings: OptimiseSettings; onChange: (s: OptimiseSettings) => void }) {
  const webpMin = settings.webpNearLossless ? 60 : 70;
  const webpMax = settings.webpNearLossless ? 100 : 95;

  return (
    <div>
      <div className="settings-section-title">Quality</div>
      <div className="settings-section">
        <SliderRow
          label="WebP quality"
          value={settings.webpQuality}
          min={webpMin}
          max={webpMax}
          hint="Higher = larger files"
          onChange={(v) => set(settings, onChange, 'webpQuality', v)}
        />
      </div>

      <Disclosure>
        {({ open: advOpen }) => (
          <>
            <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Advanced</span>
              <Disclosure.Button
                className="settings-row-control"
                style={{ background: 'none', border: 'none', cursor: 'default', fontSize: 13, fontWeight: 500, color: 'var(--macos-accent)' }}
              >
                {advOpen ? 'Hide' : 'Show'}
              </Disclosure.Button>
            </div>

            <Disclosure.Panel>
              <div className="settings-section">
                <ToggleRow label="WebP near-lossless" checked={settings.webpNearLossless} onChange={(v) => set(settings, onChange, 'webpNearLossless', v)} />
                <SelectRow
                  label="Effort"
                  value={String(settings.webpEffort)}
                  options={[
                    { value: '4', label: '4' },
                    { value: '5', label: '5' },
                    { value: '6', label: '6' },
                  ]}
                  onChange={(v) => set(settings, onChange, 'webpEffort', Number(v) as OptimiseSettings['webpEffort'])}
                />
                <ToggleRow label="Re-encode existing WebP" checked={settings.reencodeExistingWebp} onChange={(v) => set(settings, onChange, 'reencodeExistingWebp', v)} />
                <SelectRow
                  label="Concurrency"
                  value={settings.concurrencyMode === 'auto' ? 'auto' : String(settings.concurrencyValue)}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: '4' },
                    { value: '5', label: '5' },
                    { value: '6', label: '6' },
                  ]}
                  onChange={(v) => {
                    if (v === 'auto') {
                      onChange({ ...settings, concurrencyMode: 'auto', concurrencyValue: 3 });
                    } else {
                      onChange({ ...settings, concurrencyMode: 'manual', concurrencyValue: Number(v) });
                    }
                  }}
                />
              </div>

              {/* Danger zone */}
              <div style={{ padding: '12px 0 0' }}>
                <div className="settings-danger-section">
                  <div className="settings-danger-title">Danger zone</div>
                  <label className="settings-danger-row">
                    <input
                      type="checkbox"
                      checked={settings.replaceWithWebp}
                      onChange={(e) => set(settings, onChange, 'replaceWithWebp', e.target.checked)}
                    />
                    Replace originals with WebP
                  </label>
                  {settings.replaceWithWebp && (
                    <label className="settings-danger-row">
                      <input
                        type="checkbox"
                        checked={settings.confirmDangerousWebpReplace}
                        onChange={(e) => set(settings, onChange, 'confirmDangerousWebpReplace', e.target.checked)}
                      />
                      I understand
                    </label>
                  )}
                </div>
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </div>
  );
}

/* ── Main dialog ──────────────────────────────────────────────── */

const TAB_NAMES = ['General', 'Optimization', 'WebP'] as const;
type TabName = typeof TAB_NAMES[number];

export function SettingsDialog({ open, runMode, settings, onClose, onChange }: SettingsDialogProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('General');

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="macos-dialog w-full max-w-[480px]">
                {/* ── Header ── */}
                <div className="settings-header">
                  <span className="settings-header-title">Settings</span>
                  <button type="button" className="settings-header-close" onClick={onClose} aria-label="Close">
                    ✕
                  </button>
                </div>

                {/* ── Tabs ── */}
                <div className="settings-tabs">
                  <div className="settings-segmented">
                    {TAB_NAMES.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={activeTab === tab ? 'settings-tab-active' : ''}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Body ── */}
                <div className="settings-body">
                  {activeTab === 'General' && <GeneralPanel settings={settings} onChange={onChange} />}
                  {activeTab === 'Optimization' && <OptimizationPanel settings={settings} onChange={onChange} />}
                  {activeTab === 'WebP' && <WebPPanel settings={settings} onChange={onChange} />}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
