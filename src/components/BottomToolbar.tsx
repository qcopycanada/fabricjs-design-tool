import React from 'react';

interface BottomToolbarProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onToggleCanvasLayer?: () => void;
  currentLayer?: 'front' | 'back';
  canvasSwitchingEnabled?: boolean;
  onToggleCanvasSwitching?: (enabled: boolean) => void;
  canvases?: Array<{ id: string; name: string }>;
  activeCanvasId?: string;
  onSwitchCanvas?: (canvasId: string) => void;
  onShowKeyboardShortcuts?: () => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({ 
  zoom, 
  onZoomChange, 
  onToggleCanvasLayer,
  currentLayer = 'front',
  canvasSwitchingEnabled = false,
  onToggleCanvasSwitching,
  canvases = [],
  activeCanvasId,
  onSwitchCanvas,
  onShowKeyboardShortcuts
}) => {
  const getLayerDisplayText = () => {
    switch (currentLayer) {
      case 'front': return 'Front Canvas';
      case 'back': return 'Back Canvas';
      default: return 'Front Canvas';
    }
  };

  const getLayerColor = () => {
    switch (currentLayer) {
      case 'front': return 'bg-blue-600 hover:bg-blue-700';
      case 'back': return 'bg-green-600 hover:bg-green-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="h-12 bg-white border-t border-gray-200 flex items-center justify-between px-4">
      <div className="flex items-center space-x-4">
        {/* Keyboard Shortcuts Button */}
        {onShowKeyboardShortcuts && (
          <button
            onClick={onShowKeyboardShortcuts}
            className="flex items-center space-x-2 px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            title="View keyboard shortcuts (Press ? key)"
          >
            <span className="text-base">⌨️</span>
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
        )}
        
        <div className="text-sm text-gray-600">
          Hold <kbd className="px-1 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded">SPACE</kbd> or 
          <kbd className="px-1 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded ml-1">H</kbd> to pan • 
          <span className="text-xs text-gray-500">Mouse wheel to zoom</span>
        </div>
      </div>

      <div className="flex items-center space-x-4 min-w-0">
        {onToggleCanvasLayer && onToggleCanvasSwitching && (
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={canvasSwitchingEnabled}
                onChange={(e) => onToggleCanvasSwitching(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-xs text-gray-600">Enable Layer Switch</span>
            </label>

            {canvasSwitchingEnabled && (
              <button
                onClick={onToggleCanvasLayer}
                className={`px-3 py-1.5 text-white text-xs font-medium rounded transition-colors ${getLayerColor()}`}
                title="Switch between front and back canvas"
              >
                📋 {getLayerDisplayText()}
              </button>
            )}
          </div>
        )}

        {canvases.length > 0 && (
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-xs text-gray-500">Canvases</span>
            <div className="flex items-center gap-1 overflow-x-auto max-w-[380px] pb-1">
              {canvases.map((canvas) => (
                <button
                  key={canvas.id}
                  onClick={() => onSwitchCanvas?.(canvas.id)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors whitespace-nowrap ${
                    activeCanvasId === canvas.id
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={`Switch to ${canvas.name}`}
                >
                  {canvas.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onZoomChange(Math.max(0.1, zoom - 0.1))}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
          >
            −
          </button>
          <span className="text-sm font-medium w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(3, zoom + 0.1))}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default BottomToolbar;