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
  QrCode
} from '../utils/icons';
import type { CanvasObject } from '../types/canvas';

interface LeftSidebarProps {
  objects: CanvasObject[];
  selectedObjectId?: string | null;
  onSelectObject: (objectId: string) => void;
  onToggleVisibility: (objectId: string) => void;
  onDeleteObject: (objectId: string) => void;
  onReorderObjects?: (draggedObjectId: string, targetObjectId: string) => void;
  onRenameObject?: (objectId: string, name: string) => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  onToggleVisibility,
  onDeleteObject,
  onReorderObjects,
  onRenameObject
}) => {
  const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);
  const [dropTargetObjectId, setDropTargetObjectId] = useState<string | null>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const orderedObjects = useMemo(() => [...objects].reverse(), [objects]);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedObjectId]);

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

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
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

              return (
                <div
                  key={obj.id}
                  ref={isSelected ? selectedItemRef : null}
                  className={`flex items-center justify-between p-2 rounded text-sm group cursor-pointer transition-all duration-150 border ${
                    isSelected
                      ? 'bg-cyan-50 border-cyan-300 shadow-sm'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  } ${isDragging ? 'opacity-60 scale-[0.99]' : ''} ${isDropTarget ? 'ring-1 ring-cyan-400 bg-cyan-100/70' : ''}`}
                  onClick={() => onSelectObject(obj.id)}
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftSidebar;