import { useEffect } from "react";
import { X, Settings, Network, Clock } from "lucide-react";

export default function SettingsModal({
    isOpen,
    onClose,

    selected,
    setSelected,

    interfaces,
    ifaceLoading,

    config,
    setConfig,

    displaySettings,
    setDisplaySettings,

    estimatesEnabled,
    updateGraphSeries,

    tabs,
}) {
        useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);
    
    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>

                <div className="settings-header">
                    <div className="settings-header-title">
                        <Settings className="icon icon-accent" />
                        <h2>Settings</h2>
                    </div>
                    <button
                    onClick={onClose}
                    className="settings-close-button"
                    >
                    <X className="icon icon-accent" />
                </button>
                </div>
                

                <div className="settings-body">

                    {/* Interface Section */}
                    <div className="settings-section">
                        <div className="settings-section-title">
                            <Network className="icon icon-accent" />
                            <h3>Interface</h3>
                        </div>

                        <p className="settings-help-text">
                            Select the network interface to monitor.
                        </p>
                        {ifaceLoading ? (
                            <span className="settings-loading-text">Loading…</span>
                        ) : (
                            <select
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                                className="settings-select settings-select-full"
                                disabled={ifaceLoading || interfaces.length === 0}
                            >
                                {interfaces.length > 0 ? (
                                    interfaces.map(iface => (
                                        <option key={iface} value={iface}>{iface}</option>
                                    ))
                                ) : (
                                    <option disabled>No interfaces found</option>
                                )}
                            </select>
                        )}
                    </div>

                    {/* View Section */}
                    <div className="settings-section">
                        <div className="settings-section-title">
                            <Clock className="icon icon-muted" />
                            <span className="settings-eyebrow">View</span>
                        </div>

                        <div className="settings-row">
                            <select
                                value={config.mode}
                                onChange={e => setConfig(prev => ({ ...prev, mode: e.target.value }))}
                                className="settings-select"
                            >
                                <option value="last">Last view</option>
                                <option value="fixed">Fixed view</option>
                            </select>

                            {config.mode === 'fixed' && (
                                <select
                                    value={config.defaultTab}
                                    onChange={e => setConfig(prev => ({ ...prev, defaultTab: e.target.value }))}
                                    className="settings-select"
                                >
                                    {tabs.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Display Settings */}
                    <div className="settings-section">
                        <label className="settings-eyebrow settings-eyebrow-block">
                            Display Settings
                        </label>

                        <label className="settings-checkbox-row">
                            <input
                                type="checkbox"
                                checked={estimatesEnabled}
                                onChange={(e) =>
                                    setDisplaySettings(prev => ({
                                        ...prev,
                                        showEstimates: e.target.checked
                                    }))
                                }
                            />
                            Show Estimates
                        </label>
                    </div>

                    {/* Graph Series */}
                    <div className="settings-section">
                        <h4 className="settings-subheading">Graph Series</h4>

                        <div className="settings-checkbox-list">

                            <label className="settings-checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={displaySettings.graphSeries.rx}
                                    onChange={(e) =>
                                        updateGraphSeries('rx', e.target.checked)
                                    }
                                />
                                RX
                            </label>

                            <label className="settings-checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={displaySettings.graphSeries.tx}
                                    onChange={(e) =>
                                        updateGraphSeries('tx', e.target.checked)
                                    }
                                />
                                TX
                            </label>

                            <label className="settings-checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={displaySettings.graphSeries.total}
                                    onChange={(e) =>
                                        updateGraphSeries('total', e.target.checked)
                                    }
                                />
                                Total
                            </label>

                            {estimatesEnabled && (
                                <>
                                    <label className="settings-checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={displaySettings.graphSeries.estimateRx}
                                            onChange={(e) =>
                                                updateGraphSeries('estimateRx', e.target.checked)
                                            }
                                        />
                                        Estimate RX
                                    </label>

                                    <label className="settings-checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={displaySettings.graphSeries.estimateTx}
                                            onChange={(e) =>
                                                updateGraphSeries('estimateTx', e.target.checked)
                                            }
                                        />
                                        Estimate TX
                                    </label>

                                    <label className="settings-checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={displaySettings.graphSeries.estimateTotal}
                                            onChange={(e) =>
                                                updateGraphSeries('estimateTotal', e.target.checked)
                                            }
                                        />
                                        Estimate Total
                                    </label>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
};
