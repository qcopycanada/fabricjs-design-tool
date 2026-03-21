import React, { useState, useRef, useEffect } from 'react';
import {
  Type,
  Image,
  Shapes,
  ChevronDown,
  Download,
  Upload,
  Undo,
  Redo,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  Group,
  Ungroup,
  QrCode,
} from '../utils/icons';
import ShapeDialog from './ShapeDialog';

interface HeaderProps {
  selectedTool: string;
  onToolSelect: (tool: string) => void;
  onAddText: () => void;
  onAddRectangle: () => void;
  onAddLine: () => void;
  onAddImage: () => void;
  onAddCircle: () => void;
  onAddTriangle: () => void;
  onAddPentagon: () => void;
  onAddHexagon: () => void;
  onAddStar: () => void;
  onAddEllipse: () => void;
  onAddArrow: () => void;
  onAddRoundedRectangle: () => void;
  onAddDiamond: () => void;
  onAddHeart: () => void;
  onAddCloud: () => void;
  onAddLightning: () => void;
  onAddSpeechBubble: () => void;
  onAddCross: () => void;
  onAddParallelogram: () => void;
  onAddTrapezoid: () => void;
  onAddOctagonShape: () => void;
  onAddQRCode?: () => void;
  onExport: (format: 'pdf' | 'png' | 'svg' | 'json' | 'jpeg') => void;
  onImportJSON?: (payload: unknown) => Promise<void> | void;
  editorMode: 'dev' | 'prod';
  onEditorModeChange: (mode: 'dev' | 'prod') => void;
  onTestCanvas?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAlignObjects: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onGroupObjects: () => void;
  onUngroupObjects: () => void;
  canGroup: boolean;
  canUngroup: boolean;
}

const shapeToolKeys = [
  'rectangle',
  'line',
  'circle',
  'triangle',
  'pentagon',
  'hexagon',
  'star',
  'ellipse',
  'arrow',
  'roundedRectangle',
  'diamond',
  'heart',
  'cloud',
  'lightning',
  'speechBubble',
  'cross',
  'parallelogram',
  'trapezoid',
  'octagonShape',
];

const Header: React.FC<HeaderProps> = ({
  selectedTool,
  onToolSelect,
  onAddText,
  onAddRectangle,
  onAddLine,
  onAddImage,
  onAddCircle,
  onAddTriangle,
  onAddPentagon,
  onAddHexagon,
  onAddStar,
  onAddEllipse,
  onAddArrow,
  onAddRoundedRectangle,
  onAddDiamond,
  onAddHeart,
  onAddCloud,
  onAddLightning,
  onAddSpeechBubble,
  onAddCross,
  onAddParallelogram,
  onAddTrapezoid,
  onAddOctagonShape,
  onAddQRCode,
  onExport,
  onImportJSON,
  editorMode,
  onEditorModeChange,
  onTestCanvas,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAlignObjects,
  onGroupObjects,
  onUngroupObjects,
  canGroup,
  canUngroup,
}) => {
  const [isShapeDialogOpen, setIsShapeDialogOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleShapeSelect = (shapeType: string) => {
    onToolSelect(shapeType);

    switch (shapeType) {
      case 'rectangle':
        onAddRectangle();
        break;
      case 'circle':
        onAddCircle();
        break;
      case 'line':
        onAddLine();
        break;
      case 'triangle':
        onAddTriangle();
        break;
      case 'pentagon':
        onAddPentagon();
        break;
      case 'hexagon':
        onAddHexagon();
        break;
      case 'star':
        onAddStar();
        break;
      case 'ellipse':
        onAddEllipse();
        break;
      case 'arrow':
        onAddArrow();
        break;
      case 'roundedRectangle':
        onAddRoundedRectangle();
        break;
      case 'diamond':
        onAddDiamond();
        break;
      case 'heart':
        onAddHeart();
        break;
      case 'cloud':
        onAddCloud();
        break;
      case 'lightning':
        onAddLightning();
        break;
      case 'speechBubble':
        onAddSpeechBubble();
        break;
      case 'cross':
        onAddCross();
        break;
      case 'parallelogram':
        onAddParallelogram();
        break;
      case 'trapezoid':
        onAddTrapezoid();
        break;
      case 'octagonShape':
        onAddOctagonShape();
        break;
      default:
        break;
    }
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportJSON) return;

    try {
      const rawText = await file.text();
      const payload = JSON.parse(rawText);
      await onImportJSON(payload);
    } catch {
      window.alert('Invalid JSON file. Please upload a valid project/template JSON.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-14">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">⚡</span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                onToolSelect('text');
                onAddText();
              }}
              aria-label="Text"
              className={`p-2 rounded-md ${selectedTool === 'text' ? 'bg-cyan-100 text-cyan-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Type size={18} />
            </button>

            <button
              onClick={() => {
                onToolSelect('image');
                onAddImage();
              }}
              aria-label="Image"
              className={`p-2 rounded-md ${selectedTool === 'image' ? 'bg-cyan-100 text-cyan-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Image size={18} />
            </button>

            <button
              onClick={onAddQRCode}
              className={`p-2 rounded-md ${selectedTool === 'qrcode' ? 'bg-cyan-100 text-cyan-600' : 'text-gray-600 hover:bg-gray-100'}`}
              title="QR Code Generator"
            >
              <QrCode size={18} />
            </button>

            <button
              onClick={() => setIsShapeDialogOpen(true)}
              className={`p-2 rounded-md ${shapeToolKeys.includes(selectedTool) ? 'bg-cyan-100 text-cyan-600' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Shapes"
            >
              <Shapes size={18} />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <div className="flex items-center space-x-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo"
              className={`p-2 rounded-md ${canUndo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <Undo size={18} />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo"
              className={`p-2 rounded-md ${canRedo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <Redo size={18} />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <div className="flex items-center space-x-1">
            <button onClick={() => onAlignObjects('left')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" title="Align Left Edges">
              <AlignStartVertical size={18} />
            </button>
            <button onClick={() => onAlignObjects('center')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" title="Align Horizontal Centers">
              <AlignHorizontalJustifyCenter size={18} />
            </button>
            <button onClick={() => onAlignObjects('right')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" title="Align Right Edges">
              <AlignEndVertical size={18} />
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1" />

            <button onClick={() => onAlignObjects('top')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" title="Align Top Edges">
              <AlignStartHorizontal size={18} />
            </button>
            <button onClick={() => onAlignObjects('middle')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" title="Align Vertical Centers">
              <AlignVerticalJustifyCenter size={18} />
            </button>
            <button onClick={() => onAlignObjects('bottom')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" title="Align Bottom Edges">
              <AlignEndHorizontal size={18} />
            </button>

            {(canGroup || canUngroup) && (
              <>
                <div className="w-px h-4 bg-gray-300 mx-1" />
                {canGroup && (
                  <button onClick={onGroupObjects} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" title="Group Selected Objects">
                    <Group size={18} />
                  </button>
                )}
                {canUngroup && (
                  <button onClick={onUngroupObjects} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md" title="Ungroup Selected Objects">
                    <Ungroup size={18} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Templates</button>

          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFileChange}
            className="hidden"
          />

          {onTestCanvas && (
            <button onClick={onTestCanvas} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md border border-red-300">
              Test Canvas
            </button>
          )}

          <button
            onClick={() => onEditorModeChange(editorMode === 'dev' ? 'prod' : 'dev')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border ${
              editorMode === 'dev'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
            }`}
            title="Toggle editor mode"
          >
            {editorMode === 'dev' ? 'Dev Mode' : 'Prod Mode'}
          </button>

          {onImportJSON && (
            <button
              onClick={() => importFileInputRef.current?.click()}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-cyan-600 text-sm font-medium rounded-md border border-cyan-300 hover:bg-cyan-50"
            >
              <Upload size={16} />
              <span>Upload JSON</span>
            </button>
          )}

          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-400 text-white text-sm font-medium rounded-md hover:bg-cyan-500"
            >
              <Download size={16} />
              <span>Export</span>
              <ChevronDown size={16} className={`transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button onClick={() => { onExport('png'); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <span>PNG (All Canvases)</span>
                  </button>
                  <button onClick={() => { onExport('jpeg'); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <span>JPEG (All Canvases)</span>
                  </button>
                  <button onClick={() => { onExport('svg'); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <span>SVG (All Canvases)</span>
                  </button>
                  <button onClick={() => { onExport('pdf'); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <span>PDF (All Canvases)</span>
                  </button>
                  <button onClick={() => { onExport('json'); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <span>JSON (All Canvases)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ShapeDialog
        isOpen={isShapeDialogOpen}
        onClose={() => setIsShapeDialogOpen(false)}
        onShapeSelect={handleShapeSelect}
      />
    </header>
  );
};

export default Header;
