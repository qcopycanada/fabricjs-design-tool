import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Trash2,
  Type,
  Square,
  Minus,
  Image,
  Circle,
  Triangle,
  Shapes,
  Octagon,
  Star,
  QrCode,
  Grid,
  Settings
} from '../utils/icons';
import type { CanvasObject } from '../types/canvas';
import ShapeDialog from './ShapeDialog';

const shapeToolKeys = [
  'shape',
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

interface LeftSidebarProps {
  objects: CanvasObject[];
  selectedObjectId?: string | null;
  onSelectObject: (objectId: string) => void;
  onToggleVisibility: (objectId: string) => void;
  onDeleteObject: (objectId: string) => void;
  onReorderObjects?: (draggedObjectId: string, targetObjectId: string) => void;
  onRenameObject?: (objectId: string, name: string) => void;
  showLayers?: boolean;
  showMainTools?: boolean;
  showBorder?: boolean;
  selectedTool?: string;
  onToolSelect?: (tool: string) => void;
  onMainToolUsed?: () => void;
  onImageToolClick?: () => void;
  onShapeToolClick?: () => void;
  onQRCodeToolClick?: () => void;
  onTableToolClick?: () => void;
  onBackgroundToolClick?: () => void;
  onAddText?: () => void;
  onAddImage?: () => void;
  onAddQRCode?: () => void;
  onAddRectangle?: () => void;
  onAddLine?: () => void;
  onAddCircle?: () => void;
  onAddTriangle?: () => void;
  onAddPentagon?: () => void;
  onAddHexagon?: () => void;
  onAddStar?: () => void;
  onAddEllipse?: () => void;
  onAddArrow?: () => void;
  onAddRoundedRectangle?: () => void;
  onAddDiamond?: () => void;
  onAddHeart?: () => void;
  onAddCloud?: () => void;
  onAddLightning?: () => void;
  onAddSpeechBubble?: () => void;
  onAddCross?: () => void;
  onAddParallelogram?: () => void;
  onAddTrapezoid?: () => void;
  onAddOctagonShape?: () => void;
  className?: string;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onToggleVisibility,
  onDeleteObject,
  onReorderObjects,
  onRenameObject,
  showLayers = true,
  showMainTools = false,
  showBorder = true,
  selectedTool = 'select',
  onToolSelect,
  onMainToolUsed,
  onImageToolClick,
  onShapeToolClick,
  onQRCodeToolClick,
  onTableToolClick,
  onBackgroundToolClick,
  onAddText,
  onAddImage,
  onAddQRCode,
  onAddRectangle,
  onAddLine,
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
  className = 'w-24'
}) => {
  const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);
  const [dropTargetObjectId, setDropTargetObjectId] = useState<string | null>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingTextObjectId, setEditingTextObjectId] = useState<string | null>(null);
  const [editingTextContent, setEditingTextContent] = useState('');
  const [isTouchReordering, setIsTouchReordering] = useState(false);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const touchMovedRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const orderedObjects = useMemo(() => [...objects].reverse(), [objects]);
  const [isShapeDialogOpen, setIsShapeDialogOpen] = useState(false);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedObjectId]);

  useEffect(() => {
    if (!isTouchReordering || !draggedObjectId) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;

      event.preventDefault();

      const movedX = Math.abs(event.clientX - touchStartPosRef.current.x);
      const movedY = Math.abs(event.clientY - touchStartPosRef.current.y);
      if (!touchMovedRef.current && (movedX > 3 || movedY > 3)) {
        touchMovedRef.current = true;
      }

      const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const layerItem = elementAtPoint?.closest('[data-layer-item-id]') as HTMLElement | null;
      const targetId = layerItem?.dataset.layerItemId || null;

      if (!targetId || targetId === draggedObjectId) {
        if (dropTargetObjectId !== null) {
          setDropTargetObjectId(null);
        }
        return;
      }

      if (targetId !== dropTargetObjectId) {
        setDropTargetObjectId(targetId);
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;

      event.preventDefault();

      if (touchMovedRef.current) {
        suppressNextClickRef.current = true;
      }

      if (draggedObjectId && dropTargetObjectId && draggedObjectId !== dropTargetObjectId) {
        onReorderObjects?.(draggedObjectId, dropTargetObjectId);
        onSelectObject(draggedObjectId);
      }

      setIsTouchReordering(false);
      setDraggedObjectId(null);
      setDropTargetObjectId(null);
      touchMovedRef.current = false;
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerEnd, { passive: false });
    document.addEventListener('pointercancel', handlePointerEnd, { passive: false });

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerEnd);
      document.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [draggedObjectId, dropTargetObjectId, isTouchReordering, onReorderObjects, onSelectObject]);

  const startRename = (objectId: string, currentName: string) => {
    setEditingObjectId(objectId);
    setEditingName(currentName);
  };

  const commitRename = () => {
    if (!editingObjectId) return;
    const trimmedName = editingName.trim();
    if (trimmedName) {
      onRenameObject?.(editingObjectId, trimmedName);
    }
    setEditingObjectId(null);
    setEditingName('');
  };

  const cancelRename = () => {
    setEditingObjectId(null);
    setEditingName('');
  };

  const startTextContentEdit = (objectId: string, currentText: string) => {
    setEditingTextObjectId(objectId);
    setEditingTextContent(currentText);
  };

  const commitTextContentEdit = (obj: CanvasObject) => {
    if (editingTextObjectId !== obj.id) return;

    const textValue = editingTextContent;
    (obj.object as any).set('text', textValue);
    if (typeof (obj.object as any).setCoords === 'function') {
      (obj.object as any).setCoords();
    }
    (obj.object as any).canvas?.renderAll();

    setEditingTextObjectId(null);
    setEditingTextContent('');
  };

  const cancelTextContentEdit = () => {
    setEditingTextObjectId(null);
    setEditingTextContent('');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type size={14} className="text-gray-500" />;
      case 'rect':
        return <Square size={14} className="text-gray-500" />;
      case 'line':
        return <Minus size={14} className="text-gray-500" />;
      case 'image':
        return <Image size={14} className="text-gray-500" />;
      case 'circle':
        return <Circle size={14} className="text-gray-500" />;
      case 'triangle':
        return <Triangle size={14} className="text-gray-500" />;
      case 'pentagon':
        return <Shapes size={14} className="text-gray-500" />;
      case 'hexagon':
        return <Octagon size={14} className="text-gray-500" />;
      case 'star':
        return <Star size={14} className="text-gray-500" />;
      case 'qrcode':
        return <QrCode size={14} className="text-gray-500" />;
      default:
        return <Type size={14} className="text-gray-500" />;
    }
  };

  const handleShapeSelect = (shapeType: string) => {
    onToolSelect?.(shapeType);

    switch (shapeType) {
      case 'rectangle':
        onAddRectangle?.();
        break;
      case 'circle':
        onAddCircle?.();
        break;
      case 'line':
        onAddLine?.();
        break;
      case 'triangle':
        onAddTriangle?.();
        break;
      case 'pentagon':
        onAddPentagon?.();
        break;
      case 'hexagon':
        onAddHexagon?.();
        break;
      case 'star':
        onAddStar?.();
        break;
      case 'ellipse':
        onAddEllipse?.();
        break;
      case 'arrow':
        onAddArrow?.();
        break;
      case 'roundedRectangle':
        onAddRoundedRectangle?.();
        break;
      case 'diamond':
        onAddDiamond?.();
        break;
      case 'heart':
        onAddHeart?.();
        break;
      case 'cloud':
        onAddCloud?.();
        break;
      case 'lightning':
        onAddLightning?.();
        break;
      case 'speechBubble':
        onAddSpeechBubble?.();
        break;
      case 'cross':
        onAddCross?.();
        break;
      case 'parallelogram':
        onAddParallelogram?.();
        break;
      case 'trapezoid':
        onAddTrapezoid?.();
        break;
      case 'octagonShape':
        onAddOctagonShape?.();
        break;
      default:
        break;
    }

    onMainToolUsed?.();
  };

  return (
    <div className={`${className} bg-white ${showBorder ? 'border-r border-gray-200' : ''} h-full flex flex-col`}>
      {showMainTools && (
        <div className="p-3 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-xs font-semibold text-gray-700 mb-2">Tools</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                onToolSelect?.('text');
                onAddText?.();
                onMainToolUsed?.();
              }}
              aria-label="Text"
              className={`h-16 w-full rounded-md flex flex-col items-center justify-center gap-1 px-2 ${selectedTool === 'text' ? 'bg-cyan-100 text-cyan-700' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Text"
            >
              <Type size={18} />
              <span className="text-[11px] font-medium leading-none">Text</span>
            </button>

            <button
              onClick={() => {
                onToolSelect?.('image');
                if (onImageToolClick) {
                  onImageToolClick();
                } else {
                  onAddImage?.();
                }
                onMainToolUsed?.();
              }}
              aria-label="Image"
              className={`h-16 w-full rounded-md flex flex-col items-center justify-center gap-1 px-2 ${selectedTool === 'image' ? 'bg-cyan-100 text-cyan-700' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Image"
            >
              <Image size={18} />
              <span className="text-[11px] font-medium leading-none">Upload</span>
            </button>

            <button
              onClick={() => {
                onToolSelect?.('qrcode');
                if (onQRCodeToolClick) {
                  onQRCodeToolClick();
                } else {
                  onAddQRCode?.();
                }
                onMainToolUsed?.();
              }}
              aria-label="QR Code"
              className={`h-16 w-full rounded-md flex flex-col items-center justify-center gap-1 px-2 ${selectedTool === 'qrcode' ? 'bg-cyan-100 text-cyan-700' : 'text-gray-600 hover:bg-gray-100'}`}
              title="QR Code"
            >
              <QrCode size={18} />
              <span className="text-[11px] font-medium leading-none">QR Code</span>
            </button>

            <button
              onClick={() => {
                onToolSelect?.('table');
                if (onTableToolClick) {
                  onTableToolClick();
                }
                onMainToolUsed?.();
              }}
              aria-label="Tables"
              className={`h-16 w-full rounded-md flex flex-col items-center justify-center gap-1 px-2 ${selectedTool === 'table' ? 'bg-cyan-100 text-cyan-700' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Tables"
            >
              <Grid size={18} />
              <span className="text-[11px] font-medium leading-none">Tables</span>
            </button>

            <button
              onClick={() => {
                onToolSelect?.('background');
                if (onBackgroundToolClick) {
                  onBackgroundToolClick();
                }
                onMainToolUsed?.();
              }}
              aria-label="Background"
              className={`h-16 w-full rounded-md flex flex-col items-center justify-center gap-1 px-2 ${selectedTool === 'background' ? 'bg-cyan-100 text-cyan-700' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Background"
            >
              <Settings size={18} />
              <span className="text-[11px] font-medium leading-none">Background</span>
            </button>

            <button
              onClick={() => {
                if (onShapeToolClick) {
                  onToolSelect?.('shape');
                  onShapeToolClick();
                  onMainToolUsed?.();
                } else {
                  setIsShapeDialogOpen(true);
                }
              }}
              aria-label="Shapes"
              className={`h-16 w-full rounded-md flex flex-col items-center justify-center gap-1 px-2 ${shapeToolKeys.includes(selectedTool) ? 'bg-cyan-100 text-cyan-700' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Shapes"
            >
              <Shapes size={18} />
              <span className="text-[11px] font-medium leading-none">Shapes</span>
            </button>
          </div>
        </div>
      )}

      {showLayers && (
        <>
          <div className="p-4 flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Layers</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pb-4">
              <div className="space-y-1">
                {orderedObjects.map((obj) => {
              const isSelected = selectedObjectId === obj.id;
              const isDragging = draggedObjectId === obj.id;
              const isDropTarget = dropTargetObjectId === obj.id && draggedObjectId !== obj.id;
              const isEditing = editingObjectId === obj.id;
              const isEditingTextContent = editingTextObjectId === obj.id;
              const isTextLayer = obj.type === 'text';
              const currentTextValue = String((obj.object as any)?.text ?? '');

              return (
                <React.Fragment key={obj.id}>
                <div
                  data-layer-item-id={obj.id}
                  ref={isSelected ? selectedItemRef : null}
                  className={`flex items-center justify-between p-2 rounded text-sm group cursor-pointer transition-all duration-150 border ${
                    isSelected
                      ? 'bg-cyan-50 border-cyan-300 shadow-sm'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  } ${isDragging ? 'opacity-60 scale-[0.99]' : ''} ${isDropTarget ? 'ring-1 ring-cyan-400 bg-cyan-100/70' : ''}`}
                  onClick={() => {
                    if (suppressNextClickRef.current) {
                      suppressNextClickRef.current = false;
                      return;
                    }
                    onSelectObject(obj.id);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    startRename(obj.id, obj.name);
                  }}
                  onKeyDown={(e) => {
                    if (isEditing) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectObject(obj.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  draggable={!isEditing}
                  onDragStart={(e) => {
                    if (isEditing) return;
                    setDraggedObjectId(obj.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDraggedObjectId(null);
                    setDropTargetObjectId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dropTargetObjectId !== obj.id) {
                      setDropTargetObjectId(obj.id);
                    }
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragLeave={() => {
                    if (dropTargetObjectId === obj.id) {
                      setDropTargetObjectId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!draggedObjectId || draggedObjectId === obj.id) {
                      setDropTargetObjectId(null);
                      return;
                    }
                    onReorderObjects?.(draggedObjectId, obj.id);
                    onSelectObject(draggedObjectId);
                    setDraggedObjectId(null);
                    setDropTargetObjectId(null);
                  }}
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span
                      className={`text-gray-400 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                      aria-hidden="true"
                      title="Drag to reorder"
                      onPointerDown={(event) => {
                        if (event.pointerType !== 'touch' || isEditing) return;

                        event.preventDefault();
                        event.stopPropagation();

                        touchStartPosRef.current = { x: event.clientX, y: event.clientY };
                        touchMovedRef.current = false;
                        setDraggedObjectId(obj.id);
                        setDropTargetObjectId(null);
                        setIsTouchReordering(true);
                      }}
                      style={{ touchAction: 'none' }}
                    >
                      ::
                    </span>
                    {getIcon(obj.type)}

                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={commitRename}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            commitRename();
                          }
                          if (e.key === 'Escape') {
                            cancelRename();
                          }
                        }}
                        className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-cyan-400 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    ) : (
                      <span
                        className={`truncate text-gray-700 ${obj.object?.visible === false ? 'opacity-50' : ''}`}
                        title="Double-click to rename layer"
                      >
                        {obj.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    {isTextLayer && (
                      <button
                        className="px-1.5 py-1 hover:bg-cyan-100 rounded text-cyan-700 text-[10px] font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTextContentEdit(obj.id, currentTextValue);
                        }}
                        title="Edit text content"
                      >
                        Text
                      </button>
                    )}
                    <button
                      className="p-1 hover:bg-gray-200 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility(obj.id);
                      }}
                      title={obj.object?.visible === false ? 'Show layer' : 'Hide layer'}
                    >
                      {obj.object?.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      className="p-1 hover:bg-red-200 rounded text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteObject(obj.id);
                      }}
                      title="Delete layer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {isTextLayer && isEditingTextContent && (
                  <div className="mt-2 px-2 pb-2" onClick={(e) => e.stopPropagation()}>
                    <label className="block text-[10px] text-gray-500 mb-1">Text Content</label>
                    <textarea
                      autoFocus
                      value={editingTextContent}
                      onChange={(e) => setEditingTextContent(e.target.value)}
                      onBlur={() => commitTextContentEdit(obj)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') {
                          cancelTextContentEdit();
                        }
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          commitTextContentEdit(obj);
                        }
                      }}
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-cyan-400 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <div className="mt-1 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelTextContentEdit();
                        }}
                        className="px-2 py-0.5 text-[10px] border border-gray-300 rounded text-gray-600 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          commitTextContentEdit(obj);
                        }}
                        className="px-2 py-0.5 text-[10px] border border-cyan-300 rounded text-cyan-700 hover:bg-cyan-50"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
                </React.Fragment>
              );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <ShapeDialog
        isOpen={isShapeDialogOpen}
        onClose={() => setIsShapeDialogOpen(false)}
        onShapeSelect={handleShapeSelect}
      />
    </div>
  );
};

export default LeftSidebar;