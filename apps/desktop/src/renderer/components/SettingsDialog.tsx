import { Dialog, Disclosure, Listbox, Switch, Tab, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import type { OptimiseSettings, RunMode } from '@/shared/types';

interface SettingsDialogProps {
  open: boolean;
  runMode: RunMode;
  settings: OptimiseSettings;
  onClose: () => void;
  onChange: (next: OptimiseSettings) => void;
}

function rangeClass(): string {
  return 'h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-900';
}

function setValue<K extends keyof OptimiseSettings>(settings: OptimiseSettings, onChange: (next: OptimiseSettings) => void, key: K, value: OptimiseSettings[K]) {
  onChange({ ...settings, [key]: value });
}

export function SettingsDialog({ open, runMode, settings, onClose, onChange }: SettingsDialogProps): JSX.Element {
  const webpMin = settings.webpNearLossless ? 60 : 70;
  const webpMax = settings.webpNearLossless ? 100 : 95;

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="card w-full max-w-2xl rounded-xl p-5 shadow-xl">
                <Dialog.Title className="text-lg font-semibold text-slate-900">Settings</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-slate-500">Default setup is safe for most users.</Dialog.Description>

                <Tab.Group>
                  <Tab.List className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
                    {['General', 'Optimization', 'WebP'].map((tab) => (
                      <Tab key={tab} className={({ selected }) => `rounded-md px-3 py-1.5 ${selected ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}>
                        {tab}
                      </Tab>
                    ))}
                  </Tab.List>
                  <Tab.Panels className="mt-4 space-y-4">
                    <Tab.Panel className="space-y-4">
                      <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
                        <legend className="px-1 text-sm font-medium text-slate-700">Output mode</legend>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="outputMode"
                            checked={settings.outputMode === 'subfolder'}
                            onChange={() => setValue(settings, onChange, 'outputMode', 'subfolder')}
                          />
                          Optimized folder (recommended)
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="outputMode"
                            checked={settings.outputMode === 'replace'}
                            onChange={() => setValue(settings, onChange, 'outputMode', 'replace')}
                          />
                          Replace originals (creates backup)
                        </label>
                        {settings.outputMode === 'replace' ? <p className="text-xs text-amber-700">Backups are created before replacement.</p> : null}
                      </fieldset>

                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <label className="mb-1 block">Export preset</label>
                        <Listbox value={settings.exportPreset} onChange={(value) => setValue(settings, onChange, 'exportPreset', value)}>
                          <div className="relative">
                            <Listbox.Button className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left">
                              {settings.exportPreset === 'original'
                                ? 'Original'
                                : settings.exportPreset === 'design'
                                  ? 'Design (Figma/Framer)'
                                  : 'Web'}
                            </Listbox.Button>
                            <Listbox.Options className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                              <Listbox.Option value="original" className={({ active }) => `cursor-default rounded px-2 py-1.5 ${active ? 'bg-slate-100' : ''}`}>
                                Original
                              </Listbox.Option>
                              <Listbox.Option value="web" className={({ active }) => `cursor-default rounded px-2 py-1.5 ${active ? 'bg-slate-100' : ''}`}>
                                Web
                              </Listbox.Option>
                              <Listbox.Option value="design" className={({ active }) => `cursor-default rounded px-2 py-1.5 ${active ? 'bg-slate-100' : ''}`}>
                                Design (Figma/Framer)
                              </Listbox.Option>
                            </Listbox.Options>
                          </div>
                        </Listbox>
                      </div>

                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <label className="mb-1 block">Naming pattern</label>
                        <input
                          type="text"
                          value={settings.namingPattern}
                          onChange={(event) => setValue(settings, onChange, 'namingPattern', event.target.value)}
                          placeholder="{name}"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                        />
                        <p className="mt-1 text-xs text-slate-500">Variables: {'{name} {ext} {width} {height} {scale} {format} {hash}'}</p>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                        <span>Keep metadata</span>
                        <Switch
                          checked={settings.keepMetadata}
                          onChange={(value) => setValue(settings, onChange, 'keepMetadata', value)}
                          className={`${settings.keepMetadata ? 'bg-slate-900' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full`}
                        >
                          <span className={`${settings.keepMetadata ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white`} />
                        </Switch>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                        <span>Optimize clipboard images automatically</span>
                        <Switch
                          checked={settings.optimizeClipboardImages}
                          onChange={(value) => setValue(settings, onChange, 'optimizeClipboardImages', value)}
                          className={`${settings.optimizeClipboardImages ? 'bg-slate-900' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full`}
                        >
                          <span
                            className={`${settings.optimizeClipboardImages ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white`}
                          />
                        </Switch>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                        <span>Allow larger outputs</span>
                        <Switch
                          checked={settings.allowLargerOutput}
                          onChange={(value) => setValue(settings, onChange, 'allowLargerOutput', value)}
                          className={`${settings.allowLargerOutput ? 'bg-slate-900' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full`}
                        >
                          <span className={`${settings.allowLargerOutput ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white`} />
                        </Switch>
                      </div>

                    </Tab.Panel>

                    <Tab.Panel className="space-y-4">
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <label className="mb-1 block">JPEG quality ({settings.jpegQuality})</label>
                        <input
                          type="range"
                          min={75}
                          max={92}
                          value={settings.jpegQuality}
                          onChange={(event) => setValue(settings, onChange, 'jpegQuality', Number(event.target.value))}
                          className={rangeClass()}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                        <span>PNG Aggressive (may change colors slightly)</span>
                        <Switch
                          checked={settings.aggressivePng}
                          onChange={(value) => setValue(settings, onChange, 'aggressivePng', value)}
                          className={`${settings.aggressivePng ? 'bg-slate-900' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full`}
                        >
                          <span className={`${settings.aggressivePng ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white`} />
                        </Switch>
                      </div>
                    </Tab.Panel>

                    <Tab.Panel className="space-y-4">
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <label className="mb-1 block">WebP quality ({settings.webpQuality})</label>
                        <input
                          type="range"
                          min={webpMin}
                          max={webpMax}
                          value={settings.webpQuality}
                          onChange={(event) => setValue(settings, onChange, 'webpQuality', Number(event.target.value))}
                          className={rangeClass()}
                        />
                        <p className="mt-1 text-xs text-slate-500">Higher = larger files</p>
                      </div>

                      <Disclosure>
                        {({ open: advancedOpen }) => (
                          <div className="rounded-lg border border-slate-200 p-3">
                            <Disclosure.Button className="flex w-full items-center justify-between text-sm font-medium text-slate-800">
                              Advanced
                              <span>{advancedOpen ? '−' : '+'}</span>
                            </Disclosure.Button>
                            <Disclosure.Panel className="mt-3 space-y-4 text-sm">
                              <div className="flex items-center justify-between">
                                <span>WebP near-lossless</span>
                                <Switch
                                  checked={settings.webpNearLossless}
                                  onChange={(value) => setValue(settings, onChange, 'webpNearLossless', value)}
                                  className={`${settings.webpNearLossless ? 'bg-slate-900' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full`}
                                >
                                  <span className={`${settings.webpNearLossless ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white`} />
                                </Switch>
                              </div>

                              <div>
                                <label className="mb-1 block">WebP effort</label>
                                <Listbox value={String(settings.webpEffort)} onChange={(value) => setValue(settings, onChange, 'webpEffort', Number(value) as OptimiseSettings['webpEffort'])}>
                                  <div className="relative">
                                    <Listbox.Button className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left">
                                      {settings.webpEffort}
                                    </Listbox.Button>
                                    <Listbox.Options className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                      {['4', '5', '6'].map((v) => (
                                        <Listbox.Option key={v} value={v} className={({ active }) => `cursor-default rounded px-2 py-1.5 ${active ? 'bg-slate-100' : ''}`}>
                                          {v}
                                        </Listbox.Option>
                                      ))}
                                    </Listbox.Options>
                                  </div>
                                </Listbox>
                              </div>

                              <div className="flex items-center justify-between">
                                <span>Re-encode existing WebP</span>
                                <Switch
                                  checked={settings.reencodeExistingWebp}
                                  onChange={(value) => setValue(settings, onChange, 'reencodeExistingWebp', value)}
                                  className={`${settings.reencodeExistingWebp ? 'bg-slate-900' : 'bg-slate-300'} relative inline-flex h-6 w-11 items-center rounded-full`}
                                >
                                  <span className={`${settings.reencodeExistingWebp ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white`} />
                                </Switch>
                              </div>

                              <div>
                                <label className="mb-1 block">Concurrency</label>
                                <Listbox
                                  value={settings.concurrencyMode === 'auto' ? 'auto' : String(settings.concurrencyValue)}
                                  onChange={(value) => {
                                    if (value === 'auto') {
                                      onChange({ ...settings, concurrencyMode: 'auto', concurrencyValue: 3 });
                                    } else {
                                      onChange({ ...settings, concurrencyMode: 'manual', concurrencyValue: Number(value) });
                                    }
                                  }}
                                >
                                  <div className="relative">
                                    <Listbox.Button className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left">
                                      {settings.concurrencyMode === 'auto' ? 'Auto' : settings.concurrencyValue}
                                    </Listbox.Button>
                                    <Listbox.Options className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                      <Listbox.Option value="auto" className={({ active }) => `cursor-default rounded px-2 py-1.5 ${active ? 'bg-slate-100' : ''}`}>
                                        Auto
                                      </Listbox.Option>
                                      {['1', '2', '3', '4', '5', '6'].map((v) => (
                                        <Listbox.Option key={v} value={v} className={({ active }) => `cursor-default rounded px-2 py-1.5 ${active ? 'bg-slate-100' : ''}`}>
                                          {v}
                                        </Listbox.Option>
                                      ))}
                                    </Listbox.Options>
                                  </div>
                                </Listbox>
                              </div>

                              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                                <p className="font-semibold">Danger zone</p>
                                <label className="mt-2 flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={settings.replaceWithWebp}
                                    onChange={(event) => setValue(settings, onChange, 'replaceWithWebp', event.target.checked)}
                                  />
                                  Replace originals with WebP
                                </label>
                                {settings.replaceWithWebp ? (
                                  <label className="mt-2 flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={settings.confirmDangerousWebpReplace}
                                      onChange={(event) => setValue(settings, onChange, 'confirmDangerousWebpReplace', event.target.checked)}
                                    />
                                    I understand
                                  </label>
                                ) : null}
                              </div>
                            </Disclosure.Panel>
                          </div>
                        )}
                      </Disclosure>
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>

                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
