import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Copy, Trash2, MoveUp, MoveDown } from '../utils/icons';
import { Shadow, Gradient, Rect, filters, FabricImage } from 'fabric';
import AlignmentGuidesSettings from './AlignmentGuidesSettings';
import type { AlignmentGuidesConfig } from '../types/canvas';

const CANVAS_DPI = 150;
const STYLE_COLOR_DECLARATION_REGEX = /(fill|stroke|stop-color|color)\s*:\s*([^;]+)/gi;

interface CanvasMockup {
  url: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  lockedInDev: boolean;
  imageWidth: number;
  imageHeight: number;
}

const normalizeSvgColorToken = (token: string): string => token.replace(/!important/gi, '').trim().toLowerCase();

const parseSvgColorTokens = (svgText: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const colors = new Set<string>();

  const addColor = (value?: string | null) => {
    if (!value) return;
    const normalized = value.replace(/!important/gi, '').trim();
    if (!normalized || normalized.toLowerCase() === 'none') return;
    colors.add(normalized);
  };

  doc.querySelectorAll('*').forEach((element) => {
    addColor(element.getAttribute('fill'));
    addColor(element.getAttribute('stroke'));
    addColor(element.getAttribute('stop-color'));
    addColor(element.getAttribute('color'));

    const style = element.getAttribute('style');
    if (style) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(STYLE_COLOR_DECLARATION_REGEX.source, STYLE_COLOR_DECLARATION_REGEX.flags);
      while ((match = regex.exec(style)) !== null) {
        addColor(match[2]);
      }
    }
  });

  doc.querySelectorAll('style').forEach((styleNode) => {
    const text = styleNode.textContent || '';
    let match: RegExpExecArray | null;
    const regex = new RegExp(STYLE_COLOR_DECLARATION_REGEX.source, STYLE_COLOR_DECLARATION_REGEX.flags);
    while ((match = regex.exec(text)) !== null) {
      addColor(match[2]);
    }
  });

  return Array.from(colors);
};

const replaceSvgColorTokens = (
  svgText: string,
  colorMap: Record<string, string>,
): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');

  const replaceToken = (token?: string | null): string | null => {
    if (!token) return token ?? null;
    const mapped = colorMap[normalizeSvgColorToken(token)];
    return mapped || token;
  };

  doc.querySelectorAll('*').forEach((element) => {
    const fill = element.getAttribute('fill');
    const stroke = element.getAttribute('stroke');
    const stopColor = element.getAttribute('stop-color');
    const objectColor = element.getAttribute('color');
    const style = element.getAttribute('style');

    const nextFill = replaceToken(fill);
    const nextStroke = replaceToken(stroke);
    const nextStopColor = replaceToken(stopColor);
    const nextObjectColor = replaceToken(objectColor);
    if (fill !== nextFill && nextFill !== null) {
      element.setAttribute('fill', nextFill);
    }
    if (stroke !== nextStroke && nextStroke !== null) {
      element.setAttribute('stroke', nextStroke);
    }
    if (stopColor !== nextStopColor && nextStopColor !== null) {
      element.setAttribute('stop-color', nextStopColor);
    }
    if (objectColor !== nextObjectColor && nextObjectColor !== null) {
      element.setAttribute('color', nextObjectColor);
    }

    if (style) {
      const updatedStyle = style.replace(STYLE_COLOR_DECLARATION_REGEX, (_whole, prop, value) => {
        const replacement = colorMap[normalizeSvgColorToken(value)];
        return `${prop}: ${replacement || value}`;
      });
      if (updatedStyle !== style) {
        element.setAttribute('style', updatedStyle);
      }
    }
  });

  doc.querySelectorAll('style').forEach((styleNode) => {
    const text = styleNode.textContent || '';
    const updatedText = text.replace(STYLE_COLOR_DECLARATION_REGEX, (_whole, prop, value) => {
      const replacement = colorMap[normalizeSvgColorToken(value)];
      return `${prop}: ${replacement || value}`;
    });
    if (updatedText !== text) {
      styleNode.textContent = updatedText;
    }
  });

  return new XMLSerializer().serializeToString(doc);
};

const toHexColor = (value: string): string => {
  const normalized = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }

  const rgbMatch = normalized.match(/^rgba?\(([^\)]+)\)$/i);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1].split(',').slice(0, 3).map((part) => Number(part.trim()));
    if ([r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      const toHex = (num: number) => num.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }

  return '#000000';
};

interface RightSidebarProps {
  selectedObject: any;
  canvas: any;
  onObjectUpdate?: () => void;
  onLockStateChange?: () => void;
  updateCanvasObjects?: () => void;
  updateCanvasDimensions?: (width: number, height: number) => void;
  canvasDimensions?: { width: number; height: number };
  canvasCount?: number;
  onCanvasCountChange?: (count: number, newCanvasName?: string) => void;
  canvasFormat?: 'portrait' | 'landscape';
  onCanvasFormatChange?: (format: 'portrait' | 'landscape') => void;
  editorMode?: 'dev' | 'prod';
  updateQRCodeColors?: (qrObject: FabricImage, foregroundColor: string, backgroundColor: string) => void;
  mockup?: CanvasMockup;
  onMockupChange?: (mockup?: CanvasMockup) => void;
  alignmentGuides?: {
    config: AlignmentGuidesConfig;
    updateConfig: (config: Partial<AlignmentGuidesConfig>) => void;
    toggle: () => void;
  };
  className?: string;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedObject,
  canvas,
  onObjectUpdate,
  onLockStateChange,
  updateCanvasObjects,
  updateCanvasDimensions,
  canvasDimensions,
  canvasCount = 1,
  onCanvasCountChange,
  canvasFormat,
  onCanvasFormatChange,
  editorMode = 'dev',
  updateQRCodeColors,
  mockup,
  onMockupChange,
  alignmentGuides,
  className = 'w-80'
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'styles'>('settings');
  const [canvasWidth, setCanvasWidth] = useState(canvasDimensions?.width || 800);
  const [canvasHeight, setCanvasHeight] = useState(canvasDimensions?.height || 600);
  const [localCanvasCount, setLocalCanvasCount] = useState(canvasCount);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [backgroundGradientEnabled, setBackgroundGradientEnabled] = useState(false);
  const [backgroundGradientType, setBackgroundGradientType] = useState<'linear' | 'radial'>('linear');
  const [backgroundGradientStartColor, setBackgroundGradientStartColor] = useState('#3b82f6');
  const [backgroundGradientEndColor, setBackgroundGradientEndColor] = useState('#1d4ed8');
  const [mockupUrl, setMockupUrl] = useState('');
  const [mockupUrlError, setMockupUrlError] = useState<string | null>(null);

  const inchesFromPixels = (pixels: number) => Number((pixels / CANVAS_DPI).toFixed(2));
  const pixelsFromInches = (inches: number) => Math.max(1, Math.round(inches * CANVAS_DPI));
  
  // Image filter states
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [svgColorMap, setSvgColorMap] = useState<Record<string, string>>({});
  
  // Background image upload ref
  const backgroundImageInputRef = useRef<HTMLInputElement>(null);
  
  // Force re-render when selectedObject changes
  const [, forceUpdate] = useState({});
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
    onObjectUpdate?.();
  }, [onObjectUpdate]);

  // Update component when selectedObject changes
  useEffect(() => {
    if (selectedObject) {
      setActiveTab('styles');
    }

    // Reset filter states when object changes
    if (selectedObject?.type === 'image') {
      setBrightness(0);
      setContrast(0);
      setSaturation(0);

      const svgSource = (selectedObject as any)?.__svgSource as string | undefined;
      const colorTokens = ((selectedObject as any)?.__svgColors as string[] | undefined) ||
        (svgSource ? parseSvgColorTokens(svgSource) : []);
      const existingMap = ((selectedObject as any)?.__svgColorMap as Record<string, string> | undefined) || {};

      const nextMap: Record<string, string> = {};
      colorTokens.forEach((token) => {
        const key = normalizeSvgColorToken(token);
        nextMap[key] = existingMap[key] || toHexColor(token);
      });
      setSvgColorMap(nextMap);
    }
    triggerUpdate();
  }, [selectedObject, triggerUpdate]);

  const isSvgImage = selectedObject?.type === 'image' && Boolean((selectedObject as any)?.__isSvgUpload);

  const applySvgColorMap = async (nextColorMap: Record<string, string>) => {
    if (!isSvgImage || !selectedObject) return;

    const originalSvgSource = ((selectedObject as any).__svgOriginalSource || (selectedObject as any).__svgSource) as string | undefined;
    if (!originalSvgSource) return;

    const updatedSvg = replaceSvgColorTokens(originalSvgSource, nextColorMap);
    const encodedSvg = btoa(unescape(encodeURIComponent(updatedSvg)));
    const svgDataUrl = `data:image/svg+xml;base64,${encodedSvg}`;

    try {
      if (typeof (selectedObject as any).setSrc === 'function') {
        await (selectedObject as any).setSrc(svgDataUrl);
      }
      (selectedObject as any).__svgSource = updatedSvg;
      (selectedObject as any).__svgOriginalSource = originalSvgSource;
      (selectedObject as any).__svgColorMap = nextColorMap;
      (selectedObject as any).__svgColors = parseSvgColorTokens(originalSvgSource);

      canvas?.renderAll();
      triggerUpdate();
    } catch {
      // Keep existing behavior if recolor fails for malformed SVG content.
    }
  };

  // Set up real-time position tracking
  useEffect(() => {
    if (!canvas || !selectedObject) return;

    const handleObjectMoving = (e: any) => {
      if (e.target === selectedObject) {
        triggerUpdate();
      }
    };

    const handleObjectScaling = (e: any) => {
      if (e.target === selectedObject) {
        triggerUpdate();
      }
    };

    const handleObjectRotating = (e: any) => {
      if (e.target === selectedObject) {
        triggerUpdate();
      }
    };

    const handleObjectModified = (e: any) => {
      if (e.target === selectedObject) {
        triggerUpdate();
      }
    };

    // Add event listeners for real-time updates
    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:scaling', handleObjectScaling);
    canvas.on('object:rotating', handleObjectRotating);
    canvas.on('object:modified', handleObjectModified);

    // Cleanup function
    return () => {
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:scaling', handleObjectScaling);
      canvas.off('object:rotating', handleObjectRotating);
      canvas.off('object:modified', handleObjectModified);
    };
  }, [canvas, selectedObject, triggerUpdate]);

  // Update canvas dimensions state when canvas or canvasDimensions change
  useEffect(() => {
    if (canvasDimensions) {
      setCanvasWidth(canvasDimensions.width);
      setCanvasHeight(canvasDimensions.height);
    } else if (canvas) {
      setCanvasWidth(canvas.width || 800);
      setCanvasHeight(canvas.height || 600);
    }
  }, [canvas, canvasDimensions]);

  useEffect(() => {
    setLocalCanvasCount(canvasCount);
  }, [canvasCount]);

  useEffect(() => {
    if (mockup?.url) {
      setMockupUrl(mockup.url);
      setMockupUrlError(null);
    }
  }, [mockup]);

  const buildDefaultMockup = (url: string, imageWidth: number, imageHeight: number): CanvasMockup => {
    const artboardWidth = canvasDimensions?.width || canvas?.width || 800;
    const artboardHeight = canvasDimensions?.height || canvas?.height || 600;
    const baseScale = Math.max((artboardWidth * 1.2) / imageWidth, (artboardHeight * 1.2) / imageHeight);

    return {
      url,
      x: artboardWidth / 2,
      y: artboardHeight / 2,
      scale: baseScale,
      rotation: 0,
      opacity: 1,
      visible: true,
      lockedInDev: false,
      imageWidth,
      imageHeight,
    };
  };

  const addMockupFromUrl = () => {
    if (editorMode !== 'dev' || !onMockupChange) return;

    const nextUrl = mockupUrl.trim();
    if (!nextUrl) {
      setMockupUrlError('Enter a valid image URL.');
      return;
    }

    setMockupUrlError(null);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const imageWidth = Math.max(1, image.naturalWidth || 1);
      const imageHeight = Math.max(1, image.naturalHeight || 1);
      const baseline = buildDefaultMockup(nextUrl, imageWidth, imageHeight);
      onMockupChange({
        ...baseline,
        opacity: mockup?.opacity ?? baseline.opacity,
        lockedInDev: mockup?.lockedInDev ?? false,
      });
    };
    image.onerror = () => {
      setMockupUrlError('Unable to load image from URL. Please verify and try again.');
    };
    image.src = nextUrl;
  };

  const removeMockup = () => {
    if (editorMode !== 'dev' || !onMockupChange) return;
    onMockupChange(undefined);
  };

  const resetMockupTransform = () => {
    if (!mockup || editorMode !== 'dev' || !onMockupChange) return;
    onMockupChange(buildDefaultMockup(mockup.url, mockup.imageWidth, mockup.imageHeight));
  };

  const updateMockupOpacity = (nextOpacity: number) => {
    if (!mockup || editorMode !== 'dev' || !onMockupChange) return;
    const clamped = Math.max(0, Math.min(1, nextOpacity));
    onMockupChange({ ...mockup, opacity: clamped });
  };

  const updateMockupScale = (nextScale: number) => {
    if (!mockup || editorMode !== 'dev' || !onMockupChange) return;
    onMockupChange({ ...mockup, scale: Math.max(0.05, nextScale) });
  };

  const toggleMockupLockInDev = (locked: boolean) => {
    if (!mockup || editorMode !== 'dev' || !onMockupChange) return;
    onMockupChange({ ...mockup, lockedInDev: locked });
  };

  const updateObjectProperty = (property: string, value: any) => {
    if (selectedObject) {
      selectedObject.set(property, value);
      canvas?.renderAll();
      triggerUpdate();
    }
  };

  const updateObjectLockState = (updates: Record<string, boolean>) => {
    if (!selectedObject) return;

    const targets = selectedObject.type === 'activeSelection' && typeof selectedObject.getObjects === 'function'
      ? selectedObject.getObjects()
      : [selectedObject];

    targets.forEach((obj: any) => {
      obj.set(updates);
      if (typeof obj.setCoords === 'function') {
        obj.setCoords();
      }
    });

    selectedObject.set(updates);
    canvas?.renderAll();
    triggerUpdate();
    onLockStateChange?.();
  };

  const updateCanvasSize = () => {
    if (editorMode === 'prod') {
      return;
    }

    if (updateCanvasDimensions) {
      // Use the parent's updateCanvasDimensions function
      updateCanvasDimensions(canvasWidth, canvasHeight);
    } else if (canvas) {
      // Fallback to local canvas update
      canvas.setWidth(canvasWidth);
      canvas.setHeight(canvasHeight);
      canvas.renderAll();
    }
  };

  const applyCanvasCount = () => {
    if (editorMode === 'prod') {
      return;
    }

    const normalizedCount = Math.max(1, Math.min(20, Number(localCanvasCount) || 1));
    setLocalCanvasCount(normalizedCount);

    const trimmedName = newCanvasName.trim();
    onCanvasCountChange?.(normalizedCount, trimmedName || undefined);

    if (trimmedName) {
      setNewCanvasName('');
    }
  };

  // Handle background image upload
  const handleBackgroundImageUpload = () => {
    backgroundImageInputRef.current?.click();
  };

  const handleBackgroundImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && canvas) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        if (imageUrl) {
          // Use Fabric.js v6 API to create and set background image
          FabricImage.fromURL(imageUrl).then((img) => {
            // Scale the image to fit the canvas
            const scaleX = canvas.width / img.width;
            const scaleY = canvas.height / img.height;
            
            img.set({
              scaleX,
              scaleY,
              left: 0,
              top: 0,
            });
            
            // Set as background image
            canvas.backgroundImage = img;
            canvas.renderAll();
          }).catch(() => {
            // Error loading background image
          });
        }
      };
      reader.readAsDataURL(file);
    }
    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  const removeBackgroundImage = () => {
    if (canvas) {
      canvas.backgroundImage = null;
      canvas.renderAll();
    }
  };

  const updateBackgroundColor = (color: string) => {
    setBackgroundColor(color);
    if (canvas && !backgroundGradientEnabled) {
      // Fabric v6: use backgroundColor property and renderAll
      canvas.backgroundColor = color;
      canvas.renderAll();
    }
  };

  const updateBackgroundGradient = () => {
    if (canvas && backgroundGradientEnabled) {
      const gradient = new Gradient({
        type: backgroundGradientType,
        coords: backgroundGradientType === 'radial' ? 
          { x1: canvas.width/2, y1: canvas.height/2, r1: 0, x2: canvas.width/2, y2: canvas.height/2, r2: Math.max(canvas.width, canvas.height)/2 } :
          { x1: 0, y1: 0, x2: canvas.width, y2: 0 },
        colorStops: [
          { offset: 0, color: backgroundGradientStartColor },
          { offset: 1, color: backgroundGradientEndColor }
        ]
      });
      canvas.backgroundColor = gradient;
      canvas.renderAll();
    }
  };

  const toggleBackgroundGradient = (enabled: boolean) => {
    setBackgroundGradientEnabled(enabled);
    if (enabled) {
      updateBackgroundGradient();
    } else {
      updateBackgroundColor(backgroundColor);
    }
  };

  // Reusable gradient component
  const renderGradientControls = (objType: string) => (
    <div>
      <label className="flex items-center space-x-2 mb-2">
        <input 
          type="checkbox" 
          checked={selectedObject.fill && typeof selectedObject.fill === 'object'}
          onChange={(e) => {
            if (e.target.checked) {
              // Create gradient
              const gradient = new Gradient({
                type: 'linear',
                coords: { x1: 0, y1: 0, x2: selectedObject.width, y2: 0 },
                colorStops: [
                  { offset: 0, color: '#3b82f6' },
                  { offset: 1, color: '#1d4ed8' }
                ]
              });
              updateObjectProperty('fill', gradient);
            } else {
              updateObjectProperty('fill', objType === 'text' ? '#000000' : '#3b82f6');
            }
          }}
          className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" 
        />
        <span className="text-xs text-gray-500">Use Gradient Fill</span>
      </label>
      
      {selectedObject.fill && typeof selectedObject.fill === 'object' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Gradient Type</label>
            <select
              value={selectedObject.fill.type || 'linear'}
              onChange={(e) => {
                const gradient = new Gradient({
                  type: e.target.value as 'linear' | 'radial',
                  coords: e.target.value === 'radial' ? 
                    { x1: selectedObject.width/2, y1: selectedObject.height/2, r1: 0, x2: selectedObject.width/2, y2: selectedObject.height/2, r2: Math.max(selectedObject.width, selectedObject.height)/2 } :
                    { x1: 0, y1: 0, x2: selectedObject.width, y2: 0 },
                  colorStops: selectedObject.fill.colorStops || [
                    { offset: 0, color: '#3b82f6' },
                    { offset: 1, color: '#1d4ed8' }
                  ]
                });
                updateObjectProperty('fill', gradient);
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={selectedObject.fill.colorStops?.[0]?.color || '#3b82f6'}
                onChange={(e) => {
                  const colorStops = [...(selectedObject.fill.colorStops || [])];
                  if (colorStops[0]) {
                    colorStops[0].color = e.target.value;
                  }
                  const gradient = new Gradient({
                    type: selectedObject.fill.type,
                    coords: selectedObject.fill.coords,
                    colorStops: colorStops
                  });
                  updateObjectProperty('fill', gradient);
                }}
                className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={selectedObject.fill.colorStops?.[0]?.color || '#3b82f6'}
                onChange={(e) => {
                  const colorStops = [...(selectedObject.fill.colorStops || [])];
                  if (colorStops[0]) {
                    colorStops[0].color = e.target.value;
                  }
                  const gradient = new Gradient({
                    type: selectedObject.fill.type,
                    coords: selectedObject.fill.coords,
                    colorStops: colorStops
                  });
                  updateObjectProperty('fill', gradient);
                }}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="#3b82f6"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={selectedObject.fill.colorStops?.[1]?.color || '#1d4ed8'}
                onChange={(e) => {
                  const colorStops = [...(selectedObject.fill.colorStops || [])];
                  if (colorStops[1]) {
                    colorStops[1].color = e.target.value;
                  }
                  const gradient = new Gradient({
                    type: selectedObject.fill.type,
                    coords: selectedObject.fill.coords,
                    colorStops: colorStops
                  });
                  updateObjectProperty('fill', gradient);
                }}
                className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={selectedObject.fill.colorStops?.[1]?.color || '#1d4ed8'}
                onChange={(e) => {
                  const colorStops = [...(selectedObject.fill.colorStops || [])];
                  if (colorStops[1]) {
                    colorStops[1].color = e.target.value;
                  }
                  const gradient = new Gradient({
                    type: selectedObject.fill.type,
                    coords: selectedObject.fill.coords,
                    colorStops: colorStops
                  });
                  updateObjectProperty('fill', gradient);
                }}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="#1d4ed8"
              />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fill Color</label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={selectedObject.fill || (objType === 'text' ? '#000000' : '#3b82f6')}
              onChange={(e) => updateObjectProperty('fill', e.target.value)}
              className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={selectedObject.fill || (objType === 'text' ? '#000000' : '#3b82f6')}
              onChange={(e) => updateObjectProperty('fill', e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder={objType === 'text' ? '#000000' : '#3b82f6'}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderMockupControls = () => {
    if (editorMode === 'prod') {
      return null;
    }

    return (
    <div>
      <h5 className="text-sm font-medium text-gray-600 mb-3">Mockup Placeholders</h5>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Image URL</label>
          <input
            type="text"
            value={mockupUrl}
            onChange={(e) => {
              setMockupUrl(e.target.value);
              if (mockupUrlError) {
                setMockupUrlError(null);
              }
            }}
            placeholder="https://..."
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          {mockupUrlError && (
            <p className="mt-1 text-xs text-red-600">{mockupUrlError}</p>
          )}
        </div>

        <button
          onClick={addMockupFromUrl}
          disabled={editorMode !== 'dev'}
          className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={16} />
          <span>Add Mockup</span>
        </button>

        <button
          onClick={removeMockup}
          disabled={editorMode !== 'dev' || !mockup}
          className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} />
          <span>Remove Mockup</span>
        </button>

        {mockup && (
          <div className="space-y-3 rounded-md border border-gray-200 p-3 bg-gray-50">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Opacity</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={mockup.opacity}
                  onChange={(e) => updateMockupOpacity(Number(e.target.value))}
                  disabled={editorMode !== 'dev'}
                  className="flex-1"
                />
                <span className="w-12 text-xs text-gray-600 text-right">
                  {Math.round(mockup.opacity * 100)}%
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Scale</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.05"
                  max="4"
                  step="0.01"
                  value={mockup.scale}
                  onChange={(e) => updateMockupScale(Number(e.target.value))}
                  disabled={editorMode !== 'dev'}
                  className="flex-1"
                />
                <span className="w-12 text-xs text-gray-600 text-right">
                  {Math.round(mockup.scale * 100)}%
                </span>
              </div>
            </div>

            <button
              onClick={resetMockupTransform}
              disabled={editorMode !== 'dev'}
              className="w-full px-3 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Transform
            </button>

            <label className="flex items-center justify-between text-xs text-gray-700">
              <span>Lock In Dev Mode</span>
              <input
                type="checkbox"
                checked={Boolean(mockup.lockedInDev)}
                onChange={(e) => toggleMockupLockInDev(e.target.checked)}
                disabled={editorMode !== 'dev'}
                className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
              />
            </label>
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <div className={`${className} bg-white border-l border-gray-200 h-full flex flex-col`}>
      {/* Hidden file input for background image upload */}
      <input
        ref={backgroundImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleBackgroundImageChange}
        className="hidden"
      />
      
      {/* Tab Headers */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <div className="flex">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-sm font-medium text-center ${
              activeTab === 'settings'
                ? 'text-cyan-600 border-b-2 border-cyan-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('styles')}
            className={`flex-1 py-3 text-sm font-medium text-center ${
              activeTab === 'styles'
                ? 'text-cyan-600 border-b-2 border-cyan-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50'
            }`}
          >
            Styles
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {activeTab === 'settings' && (
          <div className="space-y-6">
            {selectedObject ? (
              <div className="space-y-6">
                {/* Object Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    {selectedObject.type === 'text' && 'Text Object'}
                    {selectedObject.type === 'rect' && 'Rectangle Object'}
                    {selectedObject.type === 'line' && 'Line Object'}
                    {selectedObject.type === 'image' && 'Image Object'}
                    {selectedObject.type === 'circle' && 'Circle Object'}
                    {selectedObject.type === 'triangle' && 'Triangle Object'}
                    {selectedObject.type === 'pentagon' && 'Pentagon Object'}
                    {selectedObject.type === 'hexagon' && 'Hexagon Object'}
                    {selectedObject.type === 'star' && 'Star Object'}
                    {(!selectedObject.type || !['text', 'rect', 'line', 'image', 'circle', 'triangle', 'pentagon', 'hexagon', 'star'].includes(selectedObject.type)) && 'Object'}
                  </h4>
                  <div className="space-y-3">
                    {!selectedObject.hideObjectActions && (
                      <>
                        {/* Position */}
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-400 mb-1">X-axis</label>
                              <input
                                type="number"
                                value={Math.round(selectedObject.left || 0)}
                                onChange={(e) => updateObjectProperty('left', Number(e.target.value))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-400 mb-1">Y-axis</label>
                              <input
                                type="number"
                                value={Math.round(selectedObject.top || 0)}
                                onChange={(e) => updateObjectProperty('top', Number(e.target.value))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Size - Different for different object types */}
                        {selectedObject.type !== 'line' && (
                          <div>
                            <div className="flex items-center space-x-2">
                              <div className="flex-1">
                                <label className="block text-xs text-gray-400 mb-1">Width</label>
                                <input
                                  type="number"
                                  value={Math.round(selectedObject.width * (selectedObject.scaleX || 1))}
                                  onChange={(e) => {
                                    const newWidth = Number(e.target.value);
                                    updateObjectProperty('scaleX', newWidth / selectedObject.width);
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs text-gray-400 mb-1">Height</label>
                                <input
                                  type="number"
                                  value={Math.round(selectedObject.height * (selectedObject.scaleY || 1))}
                                  onChange={(e) => {
                                    const newHeight = Number(e.target.value);
                                    updateObjectProperty('scaleY', newHeight / selectedObject.height);
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Rotation */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">Rotation</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={selectedObject.angle || 0}
                              onChange={(e) => updateObjectProperty('angle', Number(e.target.value))}
                              className="flex-1"
                            />
                            <input
                              type="number"
                              min="0"
                              max="360"
                              value={Math.round(selectedObject.angle || 0)}
                              onChange={(e) => updateObjectProperty('angle', Number(e.target.value))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                            <span className="text-xs text-gray-400">°</span>
                          </div>
                        </div>

                        {/* Opacity */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">Opacity</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={selectedObject.opacity || 1}
                              onChange={(e) => updateObjectProperty('opacity', Number(e.target.value))}
                              className="flex-1"
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round((selectedObject.opacity || 1) * 100)}
                              onChange={(e) => updateObjectProperty('opacity', Number(e.target.value) / 100)}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        </div>

                        {/* Transform Controls */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">Transform</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                updateObjectProperty('flipX', !selectedObject.flipX);
                              }}
                              className={`px-2 py-1.5 text-xs border rounded ${
                                selectedObject.flipX 
                                  ? 'bg-cyan-100 text-cyan-600 border-cyan-300' 
                                  : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              Flip H
                            </button>
                            <button 
                              onClick={() => {
                                updateObjectProperty('flipY', !selectedObject.flipY);
                              }}
                              className={`px-2 py-1.5 text-xs border rounded ${
                                selectedObject.flipY 
                                  ? 'bg-cyan-100 text-cyan-600 border-cyan-300' 
                                  : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              Flip V
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1 mt-2">
                            <button 
                              onClick={() => {
                                updateObjectProperty('angle', (selectedObject.angle || 0) - 90);
                              }}
                              className="px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              -90°
                            </button>
                            <button 
                              onClick={() => {
                                updateObjectProperty('angle', 0);
                              }}
                              className="px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Reset
                            </button>
                            <button 
                              onClick={() => {
                                updateObjectProperty('angle', (selectedObject.angle || 0) + 90);
                              }}
                              className="px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              +90°
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {!selectedObject.hideObjectActions && (
                      <>
                        {/* Object Actions */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">Object Actions</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                if (selectedObject && canvas) {
                                  // Use Fabric.js clone method properly
                                  selectedObject.clone().then((cloned: any) => {
                                    cloned.set({
                                      left: (cloned.left || 0) + 10,
                                      top: (cloned.top || 0) + 10,
                                    });
                                    canvas.add(cloned);
                                    canvas.setActiveObject(cloned);
                                    canvas.renderAll();
                                    
                                    // Update the objects list after canvas operations complete
                                    setTimeout(() => {
                                      updateCanvasObjects?.();
                                      triggerUpdate();
                                    }, 50);
                                  }).catch(() => {
                                    // Fallback to the callback-based clone method
                                    selectedObject.clone((cloned: any) => {
                                      cloned.set({
                                        left: (cloned.left || 0) + 10,
                                        top: (cloned.top || 0) + 10,
                                      });
                                      canvas.add(cloned);
                                      canvas.setActiveObject(cloned);
                                      canvas.renderAll();
                                      
                                      setTimeout(() => {
                                        updateCanvasObjects?.();
                                        triggerUpdate();
                                      }, 50);
                                    });
                                  });
                                }
                              }}
                              className="flex items-center justify-center space-x-1 px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <Copy size={12} />
                              <span>Duplicate</span>
                            </button>
                            <button 
                              onClick={() => {
                                if (selectedObject && canvas) {
                                  canvas.remove(selectedObject);
                                  canvas.discardActiveObject();
                                  canvas.renderAll();
                                  
                                  // Update the objects list after canvas operations complete
                                  setTimeout(() => {
                                    updateCanvasObjects?.();
                                    triggerUpdate();
                                  }, 50);
                                }
                              }}
                              className="flex items-center justify-center space-x-1 px-2 py-1.5 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Enhanced Layer Controls */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">Layer Position</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                if (selectedObject && canvas) {
                                  canvas.bringObjectForward(selectedObject);
                                  canvas.renderAll();
                                  triggerUpdate();
                                }
                              }}
                              className="flex items-center justify-center space-x-1 px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <MoveUp size={12} />
                              <span>Forward</span>
                            </button>
                            <button 
                              onClick={() => {
                                if (selectedObject && canvas) {
                                  canvas.sendObjectBackwards(selectedObject);
                                  canvas.renderAll();
                                  triggerUpdate();
                                }
                              }}
                              className="flex items-center justify-center space-x-1 px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <MoveDown size={12} />
                              <span>Backward</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <button 
                              onClick={() => {
                                if (selectedObject && canvas) {
                                  canvas.bringObjectToFront(selectedObject);
                                  canvas.renderAll();
                                  triggerUpdate();
                                }
                              }}
                              className="px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              To Front
                            </button>
                            <button 
                              onClick={() => {
                                if (selectedObject && canvas) {
                                  canvas.sendObjectToBack(selectedObject);
                                  canvas.renderAll();
                                  triggerUpdate();
                                }
                              }}
                              className="px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              To Back
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Lock/Unlock */}
                    {editorMode === 'dev' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-2">Object State</label>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              checked={selectedObject.lockMovementX && selectedObject.lockMovementY}
                              onChange={(e) => {
                                updateObjectLockState({
                                  lockMovementX: e.target.checked,
                                  lockMovementY: e.target.checked,
                                });
                              }}
                              className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" 
                            />
                            <span className="text-sm text-gray-700">Lock Movement</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              checked={selectedObject.lockScalingX && selectedObject.lockScalingY}
                              onChange={(e) => {
                                updateObjectLockState({
                                  lockScalingX: e.target.checked,
                                  lockScalingY: e.target.checked,
                                });
                              }}
                              className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" 
                            />
                            <span className="text-sm text-gray-700">Lock Scaling</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              checked={selectedObject.lockRotation}
                              onChange={(e) => {
                                updateObjectLockState({
                                  lockRotation: e.target.checked,
                                });
                              }}
                              className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" 
                            />
                            <span className="text-sm text-gray-700">Lock Rotation</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedObject.hideObjectActions)}
                              onChange={(e) => {
                                updateObjectLockState({
                                  hideObjectActions: e.target.checked,
                                });
                              }}
                              className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                            />
                            <span className="text-sm text-gray-700">Object Actions</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Canvas Section */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Canvas</h4>
                  <div className="space-y-3">
                    {editorMode === 'dev' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Number of Canvases</label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={localCanvasCount}
                            onChange={(e) => setLocalCanvasCount(Number(e.target.value))}
                            onBlur={applyCanvasCount}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                applyCanvasCount();
                              }
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">New Canvas Name (optional)</label>
                          <input
                            type="text"
                            value={newCanvasName}
                            onChange={(e) => setNewCanvasName(e.target.value)}
                            placeholder="e.g. Cover, Page, Artboard"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Width (in)</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              aria-label="Width"
                              value={inchesFromPixels(canvasWidth)}
                              onChange={(e) => {
                                const parsed = Number(e.target.value);
                                if (Number.isFinite(parsed)) {
                                  setCanvasWidth(pixelsFromInches(parsed));
                                }
                              }}
                              onBlur={updateCanvasSize}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Height (in)</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              aria-label="Height"
                              value={inchesFromPixels(canvasHeight)}
                              onChange={(e) => {
                                const parsed = Number(e.target.value);
                                if (Number.isFinite(parsed)) {
                                  setCanvasHeight(pixelsFromInches(parsed));
                                }
                              }}
                              onBlur={updateCanvasSize}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        </div>
                        <button
                          onClick={updateCanvasSize}
                          className="w-full mt-2 px-3 py-2 bg-cyan-500 text-white text-sm font-medium rounded hover:bg-cyan-600"
                        >
                          Update Size
                        </button>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Format</label>
                          <select
                            value={canvasFormat || (canvasWidth >= canvasHeight ? 'landscape' : 'portrait')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            onChange={(e) => {
                              const value = e.target.value as 'portrait' | 'landscape';

                              if (onCanvasFormatChange) {
                                onCanvasFormatChange(value);
                                return;
                              }

                              if (value === 'portrait' && canvasWidth > canvasHeight) {
                                const newWidth = canvasHeight;
                                const newHeight = canvasWidth;
                                setCanvasWidth(newWidth);
                                setCanvasHeight(newHeight);
                                updateCanvasDimensions?.(newWidth, newHeight);
                                setTimeout(() => {
                                  if (canvas) {
                                    canvas.renderAll();
                                  }
                                }, 50);
                              }

                              if (value === 'landscape' && canvasHeight > canvasWidth) {
                                const newWidth = canvasHeight;
                                const newHeight = canvasWidth;
                                setCanvasWidth(newWidth);
                                setCanvasHeight(newHeight);
                                updateCanvasDimensions?.(newWidth, newHeight);
                                setTimeout(() => {
                                  if (canvas) {
                                    canvas.renderAll();
                                  }
                                }, 50);
                              }
                            }}
                          >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Background Color & Gradient */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Background</h4>
                  <div className="space-y-3">
                    {/* Gradient Toggle */}
                    <div>
                      <label className="flex items-center space-x-2 mb-2">
                        <input 
                          type="checkbox" 
                          checked={backgroundGradientEnabled}
                          onChange={(e) => toggleBackgroundGradient(e.target.checked)}
                          className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" 
                        />
                        <span className="text-xs text-gray-500">Use Gradient Background</span>
                      </label>
                    </div>

                    {backgroundGradientEnabled ? (
                      /* Gradient Controls */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Gradient Type</label>
                          <select
                            value={backgroundGradientType}
                            onChange={(e) => {
                              setBackgroundGradientType(e.target.value as 'linear' | 'radial');
                              setTimeout(updateBackgroundGradient, 0);
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            <option value="linear">Linear</option>
                            <option value="radial">Radial</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Start Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={backgroundGradientStartColor}
                              onChange={(e) => {
                                setBackgroundGradientStartColor(e.target.value);
                                setTimeout(updateBackgroundGradient, 0);
                              }}
                              className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={backgroundGradientStartColor}
                              onChange={(e) => {
                                setBackgroundGradientStartColor(e.target.value);
                                setTimeout(updateBackgroundGradient, 0);
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              placeholder="#3b82f6"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">End Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={backgroundGradientEndColor}
                              onChange={(e) => {
                                setBackgroundGradientEndColor(e.target.value);
                                setTimeout(updateBackgroundGradient, 0);
                              }}
                              className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={backgroundGradientEndColor}
                              onChange={(e) => {
                                setBackgroundGradientEndColor(e.target.value);
                                setTimeout(updateBackgroundGradient, 0);
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              placeholder="#1d4ed8"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Solid Color Controls */
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          aria-label="Background Color"
                          value={backgroundColor}
                          onChange={(e) => updateBackgroundColor(e.target.value)}
                          className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={backgroundColor}
                          onChange={(e) => updateBackgroundColor(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="#ffffff"
                        />
                      </div>
                    )}
                    
                    <button 
                      onClick={handleBackgroundImageUpload}
                      className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      <Upload size={16} />
                      <span>Upload Image</span>
                    </button>
                    
                    <button 
                      onClick={removeBackgroundImage}
                      className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      <span>Remove Background</span>
                    </button>

                    {renderMockupControls()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'styles' && (
          <div className="space-y-4">
            {selectedObject ? (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">
                  {selectedObject.type === 'text' && 'Text Properties'}
                  {selectedObject.type === 'rect' && 'Rectangle Properties'}
                  {selectedObject.type === 'line' && 'Line Properties'}
                  {selectedObject.type === 'image' && 'Image Properties'}
                  {selectedObject.type === 'circle' && 'Circle Properties'}
                  {selectedObject.type === 'triangle' && 'Triangle Properties'}
                  {selectedObject.type === 'pentagon' && 'Pentagon Properties'}
                  {selectedObject.type === 'hexagon' && 'Hexagon Properties'}
                  {selectedObject.type === 'star' && 'Star Properties'}
                  {selectedObject.type === 'ellipse' && 'Ellipse Properties'}
                  {selectedObject.type === 'arrow' && 'Arrow Properties'}
                  {selectedObject.type === 'rounded-rectangle' && 'Rounded Rectangle Properties'}
                  {selectedObject.type === 'diamond' && 'Diamond Properties'}
                  {selectedObject.type === 'heart' && 'Heart Properties'}
                  {selectedObject.type === 'cloud' && 'Cloud Properties'}
                  {selectedObject.type === 'lightning' && 'Lightning Properties'}
                  {selectedObject.type === 'speech-bubble' && 'Speech Bubble Properties'}
                  {selectedObject.type === 'cross' && 'Cross Properties'}
                  {selectedObject.type === 'parallelogram' && 'Parallelogram Properties'}
                  {selectedObject.type === 'trapezoid' && 'Trapezoid Properties'}
                  {selectedObject.type === 'octagon' && 'Octagon Properties'}
                  {selectedObject.type === 'qrcode' && 'QR Code Properties'}
                  {(!selectedObject.type || !['text', 'rect', 'line', 'image', 'circle', 'triangle', 'pentagon', 'hexagon', 'star', 'ellipse', 'arrow', 'rounded-rectangle', 'diamond', 'heart', 'cloud', 'lightning', 'speech-bubble', 'cross', 'parallelogram', 'trapezoid', 'octagon', 'qrcode'].includes(selectedObject.type)) && 'Style Properties'}
                </h4>
                

                
                {/* Text Object Properties */}
                {selectedObject.type === 'text' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Text Content</label>
                      <textarea
                        value={selectedObject.text || ''}
                        onChange={(e) => updateObjectProperty('text', e.target.value)}
                        rows={3}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder="Enter text..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Font Family</label>
                      <select
                        value={selectedObject.fontFamily || 'Arial'}
                        onChange={(e) => updateObjectProperty('fontFamily', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Impact">Impact</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Font Size</label>
                        <input
                          type="number"
                          min="8"
                          max="200"
                          value={selectedObject.fontSize || 20}
                          onChange={(e) => updateObjectProperty('fontSize', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Line Height</label>
                        <input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={selectedObject.lineHeight || 1.16}
                          onChange={(e) => updateObjectProperty('lineHeight', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Letter Spacing</label>
                      <input
                        type="number"
                        min="-50"
                        max="100"
                        step="1"
                        value={selectedObject.charSpacing || 0}
                        onChange={(e) => updateObjectProperty('charSpacing', Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder="0"
                      />
                    </div>
                    {renderGradientControls('text')}
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Text Style</label>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            updateObjectProperty('fontWeight', selectedObject.fontWeight === 'bold' ? 'normal' : 'bold');
                          }}
                          className={`px-3 py-1 text-sm border rounded ${
                            selectedObject.fontWeight === 'bold' 
                              ? 'bg-cyan-100 text-cyan-600 border-cyan-300' 
                              : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <strong>B</strong>
                        </button>
                        <button
                          onClick={() => {
                            updateObjectProperty('fontStyle', selectedObject.fontStyle === 'italic' ? 'normal' : 'italic');
                          }}
                          className={`px-3 py-1 text-sm border rounded ${
                            selectedObject.fontStyle === 'italic' 
                              ? 'bg-cyan-100 text-cyan-600 border-cyan-300' 
                              : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <em>I</em>
                        </button>
                        <button
                          onClick={() => {
                            updateObjectProperty('underline', !selectedObject.underline);
                          }}
                          className={`px-3 py-1 text-sm border rounded ${
                            selectedObject.underline 
                              ? 'bg-cyan-100 text-cyan-600 border-cyan-300' 
                              : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <u>U</u>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Text Align</label>
                      <div className="flex items-center space-x-1">
                        {['left', 'center', 'right', 'justify'].map(align => (
                          <button
                            key={align}
                            onClick={() => {
                              updateObjectProperty('textAlign', align);
                            }}
                            className={`flex-1 px-2 py-1 text-xs border rounded ${
                              selectedObject.textAlign === align 
                                ? 'bg-cyan-100 text-cyan-600 border-cyan-300' 
                                : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center space-x-2 mb-2">
                        <input 
                          type="checkbox" 
                          checked={selectedObject.shadow !== null}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const shadow = new Shadow({
                                color: 'rgba(0,0,0,0.3)',
                                blur: 5,
                                offsetX: 2,
                                offsetY: 2
                              });
                              updateObjectProperty('shadow', shadow);
                            } else {
                              updateObjectProperty('shadow', null);
                            }
                          }}
                          className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" 
                        />
                        <span className="text-xs text-gray-500">Text Shadow</span>
                      </label>
                      
                      {selectedObject.shadow && (
                        <div className="space-y-2 pl-6">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-400 mb-1">X Offset</label>
                              <input
                                type="number"
                                min="-20"
                                max="20"
                                value={selectedObject.shadow.offsetX || 2}
                                onChange={(e) => {
                                  const shadow = new Shadow({
                                    ...selectedObject.shadow,
                                    offsetX: Number(e.target.value)
                                  });
                                  updateObjectProperty('shadow', shadow);
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-400 mb-1">Y Offset</label>
                              <input
                                type="number"
                                min="-20"
                                max="20"
                                value={selectedObject.shadow.offsetY || 2}
                                onChange={(e) => {
                                  const shadow = new Shadow({
                                    ...selectedObject.shadow,
                                    offsetY: Number(e.target.value)
                                  });
                                  updateObjectProperty('shadow', shadow);
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Blur</label>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              value={selectedObject.shadow.blur || 5}
                              onChange={(e) => {
                                const shadow = new Shadow({
                                  ...selectedObject.shadow,
                                  blur: Number(e.target.value)
                                });
                                updateObjectProperty('shadow', shadow);
                              }}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Shadow Color</label>
                            <input
                              type="color"
                              value={selectedObject.shadow.color || '#000000'}
                              onChange={(e) => {
                                const shadow = new Shadow({
                                  ...selectedObject.shadow,
                                  color: e.target.value
                                });
                                updateObjectProperty('shadow', shadow);
                              }}
                              className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rectangle Object Properties */}
                {selectedObject.type === 'rect' && (
                  <div className="space-y-3">
                    {renderGradientControls('rect')}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Stroke Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={selectedObject.stroke || '#000000'}
                          onChange={(e) => updateObjectProperty('stroke', e.target.value)}
                          className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedObject.stroke || '#000000'}
                          onChange={(e) => updateObjectProperty('stroke', e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Stroke Width</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={selectedObject.strokeWidth || 0}
                        onChange={(e) => updateObjectProperty('strokeWidth', Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Corner Radius</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={selectedObject.rx || 0}
                        onChange={(e) => {
                          const radius = Number(e.target.value);
                          selectedObject.set('rx', radius);
                          selectedObject.set('ry', radius);
                          canvas?.renderAll();
                          triggerUpdate();
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* Line Object Properties */}
                {selectedObject.type === 'line' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Stroke Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={selectedObject.stroke || '#000000'}
                          onChange={(e) => updateObjectProperty('stroke', e.target.value)}
                          className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedObject.stroke || '#000000'}
                          onChange={(e) => updateObjectProperty('stroke', e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Stroke Width</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={selectedObject.strokeWidth || 2}
                        onChange={(e) => updateObjectProperty('strokeWidth', Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Line Style</label>
                      <select
                        value={
                          !selectedObject.strokeDashArray ? 'solid' :
                          JSON.stringify(selectedObject.strokeDashArray) === JSON.stringify([5, 5]) ? 'dashed' :
                          JSON.stringify(selectedObject.strokeDashArray) === JSON.stringify([1, 4]) ? 'dotted' :
                          JSON.stringify(selectedObject.strokeDashArray) === JSON.stringify([10, 5, 2, 5]) ? 'dash-dot' :
                          'custom'
                        }
                        onChange={(e) => {
                          let dashArray = null;
                          switch(e.target.value) {
                            case 'solid':
                              dashArray = null;
                              break;
                            case 'dashed':
                              dashArray = [5, 5];
                              break;
                            case 'dotted':
                              dashArray = [1, 4];
                              break;
                            case 'dash-dot':
                              dashArray = [10, 5, 2, 5];
                              break;
                          }
                          updateObjectProperty('strokeDashArray', dashArray);
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                        <option value="dash-dot">Dash-Dot</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Line Caps</label>
                      <select
                        value={selectedObject.strokeLineCap || 'butt'}
                        onChange={(e) => updateObjectProperty('strokeLineCap', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="butt">Butt</option>
                        <option value="round">Round</option>
                        <option value="square">Square</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Shape Objects (Circle, Triangle, Pentagon, Hexagon, Star, and all custom shapes) Properties */}
                {['circle', 'triangle', 'pentagon', 'hexagon', 'star', 'ellipse', 'arrow', 'rounded-rectangle', 'diamond', 'heart', 'cloud', 'lightning', 'speech-bubble', 'cross', 'parallelogram', 'trapezoid', 'octagon', 'polygon'].includes(selectedObject.type) && (
                  <div className="space-y-3">
                    {renderGradientControls('shape')}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Stroke Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={selectedObject.stroke || '#000000'}
                          onChange={(e) => updateObjectProperty('stroke', e.target.value)}
                          className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedObject.stroke || '#000000'}
                          onChange={(e) => updateObjectProperty('stroke', e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Stroke Width</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={selectedObject.strokeWidth || 0}
                        onChange={(e) => updateObjectProperty('strokeWidth', Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                    {selectedObject.type === 'circle' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Radius</label>
                        <input
                          type="number"
                          min="10"
                          max="200"
                          value={selectedObject.radius || 60}
                          onChange={(e) => updateObjectProperty('radius', Number(e.target.value))}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    )}
                    {selectedObject.type === 'ellipse' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">X Radius</label>
                          <input
                            type="number"
                            min="10"
                            max="200"
                            value={selectedObject.rx || 60}
                            onChange={(e) => updateObjectProperty('rx', Number(e.target.value))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Y Radius</label>
                          <input
                            type="number"
                            min="10"
                            max="200"
                            value={selectedObject.ry || 40}
                            onChange={(e) => updateObjectProperty('ry', Number(e.target.value))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                      </div>
                    )}
                    {selectedObject.type === 'rounded-rectangle' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Corner Radius</label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={selectedObject.rx || 10}
                          onChange={(e) => {
                            const radius = Number(e.target.value);
                            selectedObject.set('rx', radius);
                            selectedObject.set('ry', radius);
                            canvas?.renderAll();
                            triggerUpdate();
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Image Object Properties */}
                {selectedObject.type === 'image' && (
                  <div className="space-y-3">
                    {isSvgImage && Object.keys(svgColorMap).length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">SVG Colors</label>
                        <div className="space-y-2">
                          {Object.entries(svgColorMap).map(([token, color]) => (
                            <div key={token} className="flex items-center space-x-2">
                              <span
                                className="w-4 h-4 border border-gray-300 rounded"
                                style={{ backgroundColor: color }}
                              />
                              <input
                                type="color"
                                value={toHexColor(color)}
                                onChange={async (e) => {
                                  const nextMap = { ...svgColorMap, [token]: e.target.value };
                                  setSvgColorMap(nextMap);
                                  await applySvgColorMap(nextMap);
                                }}
                                className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                              />
                              <input
                                type="text"
                                value={color}
                                onChange={(e) => {
                                  const nextMap = { ...svgColorMap, [token]: e.target.value };
                                  setSvgColorMap(nextMap);
                                }}
                                onBlur={async () => {
                                  const nextMap = { ...svgColorMap };
                                  await applySvgColorMap(nextMap);
                                }}
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                              <span className="text-[10px] text-gray-400 uppercase max-w-[72px] truncate" title={token}>
                                {token}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Filters</label>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Brightness</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="-0.5"
                              max="0.5"
                              step="0.05"
                              value={brightness}
                              onChange={(e) => {
                                const brightnessValue = Number(e.target.value);
                                setBrightness(brightnessValue);
                                const filter = new filters.Brightness({
                                  brightness: brightnessValue
                                });
                                selectedObject.filters = [filter];
                                selectedObject.applyFilters();
                                canvas?.renderAll();
                                triggerUpdate();
                              }}
                              className="flex-1"
                            />
                            <span className="text-xs text-gray-400 w-12">{brightness.toFixed(2)}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Contrast</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="-0.5"
                              max="0.5"
                              step="0.05"
                              value={contrast}
                              onChange={(e) => {
                                const contrastValue = Number(e.target.value);
                                setContrast(contrastValue);
                                const filter = new filters.Contrast({
                                  contrast: contrastValue
                                });
                                selectedObject.filters = [filter];
                                selectedObject.applyFilters();
                                canvas?.renderAll();
                                triggerUpdate();
                              }}
                              className="flex-1"
                            />
                            <span className="text-xs text-gray-400 w-12">{contrast.toFixed(2)}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Saturation</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="-1"
                              max="1"
                              step="0.1"
                              value={saturation}
                              onChange={(e) => {
                                const saturationValue = Number(e.target.value);
                                setSaturation(saturationValue);
                                const filter = new filters.Saturation({
                                  saturation: saturationValue
                                });
                                selectedObject.filters = [filter];
                                selectedObject.applyFilters();
                                canvas?.renderAll();
                                triggerUpdate();
                              }}
                              className="flex-1"
                            />
                            <span className="text-xs text-gray-400 w-12">{saturation.toFixed(1)}</span>
                          </div>
                        </div>
                        <div>
                          <button
                            onClick={() => {
                              setBrightness(0);
                              setContrast(0);
                              setSaturation(0);
                              selectedObject.filters = [];
                              selectedObject.applyFilters();
                              canvas?.renderAll();
                              triggerUpdate();
                            }}
                            className="w-full px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Reset Filters
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Border Radius</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={selectedObject.clipPath?.rx || 0}
                        onChange={(e) => {
                          const radius = Number(e.target.value);
                          if (radius > 0) {
                            const clipPath = new Rect({
                              left: 0,
                              top: 0,
                              width: selectedObject.width,
                              height: selectedObject.height,
                              rx: radius,
                              ry: radius,
                              absolutePositioned: true
                            });
                            selectedObject.set('clipPath', clipPath);
                          } else {
                            selectedObject.set('clipPath', null);
                          }
                          canvas?.renderAll();
                          triggerUpdate();
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {/* QR Code Object Properties */}
                {selectedObject.type === 'qrcode' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">QR Code Content</label>
                      <div className="text-xs text-gray-400 mb-2">
                        Type: {(selectedObject as any).qrCodeType || 'Unknown'}
                      </div>
                      <textarea
                        value={(selectedObject as any).qrCodeContent || ''}
                        readOnly
                        rows={3}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-600"
                        placeholder="QR Code content..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">QR Code Colors</label>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Foreground (Dark)</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={(selectedObject as any).qrCodeOptions?.color?.dark || '#000000'}
                              onChange={(e) => {
                                const foregroundColor = e.target.value;
                                const backgroundColor = (selectedObject as any).qrCodeOptions?.color?.light || '#FFFFFF';
                                updateQRCodeColors?.(selectedObject as FabricImage, foregroundColor, backgroundColor);
                              }}
                              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={(selectedObject as any).qrCodeOptions?.color?.dark || '#000000'}
                              onChange={(e) => {
                                const foregroundColor = e.target.value;
                                const backgroundColor = (selectedObject as any).qrCodeOptions?.color?.light || '#FFFFFF';
                                updateQRCodeColors?.(selectedObject as FabricImage, foregroundColor, backgroundColor);
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              placeholder="#000000"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Background (Light)</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={(selectedObject as any).qrCodeOptions?.color?.light || '#FFFFFF'}
                              onChange={(e) => {
                                const backgroundColor = e.target.value;
                                const foregroundColor = (selectedObject as any).qrCodeOptions?.color?.dark || '#000000';
                                updateQRCodeColors?.(selectedObject as FabricImage, foregroundColor, backgroundColor);
                              }}
                              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={(selectedObject as any).qrCodeOptions?.color?.light || '#FFFFFF'}
                              onChange={(e) => {
                                const backgroundColor = e.target.value;
                                const foregroundColor = (selectedObject as any).qrCodeOptions?.color?.dark || '#000000';
                                updateQRCodeColors?.(selectedObject as FabricImage, foregroundColor, backgroundColor);
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                        
                        {/* Quick Color Presets */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Quick Presets</label>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              onClick={() => updateQRCodeColors?.(selectedObject as FabricImage, '#000000', '#FFFFFF')}
                              className="flex items-center space-x-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <div className="w-3 h-3 bg-black border rounded"></div>
                              <span>Black</span>
                            </button>
                            <button
                              onClick={() => updateQRCodeColors?.(selectedObject as FabricImage, '#1f2937', '#f9fafb')}
                              className="flex items-center space-x-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <div className="w-3 h-3 bg-gray-800 border rounded"></div>
                              <span>Gray</span>
                            </button>
                            <button
                              onClick={() => updateQRCodeColors?.(selectedObject as FabricImage, '#1d4ed8', '#dbeafe')}
                              className="flex items-center space-x-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <div className="w-3 h-3 bg-blue-700 border rounded"></div>
                              <span>Blue</span>
                            </button>
                            <button
                              onClick={() => updateQRCodeColors?.(selectedObject as FabricImage, '#dc2626', '#fef2f2')}
                              className="flex items-center space-x-1 px-2 py-1 text-xs border border-red-300 rounded hover:bg-red-50"
                            >
                              <div className="w-3 h-3 bg-red-600 border rounded"></div>
                              <span>Red</span>
                            </button>
                            <button
                              onClick={() => updateQRCodeColors?.(selectedObject as FabricImage, '#059669', '#ecfdf5')}
                              className="flex items-center space-x-1 px-2 py-1 text-xs border border-green-300 rounded hover:bg-green-50"
                            >
                              <div className="w-3 h-3 bg-green-600 border rounded"></div>
                              <span>Green</span>
                            </button>
                            <button
                              onClick={() => updateQRCodeColors?.(selectedObject as FabricImage, '#7c3aed', '#f3e8ff')}
                              className="flex items-center space-x-1 px-2 py-1 text-xs border border-purple-300 rounded hover:bg-purple-50"
                            >
                              <div className="w-3 h-3 bg-purple-600 border rounded"></div>
                              <span>Purple</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Border Radius</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={selectedObject.clipPath?.rx || 0}
                        onChange={(e) => {
                          const radius = Number(e.target.value);
                          if (radius > 0) {
                            const clipPath = new Rect({
                              left: 0,
                              top: 0,
                              width: selectedObject.width,
                              height: selectedObject.height,
                              rx: radius,
                              ry: radius,
                              absolutePositioned: true
                            });
                            selectedObject.set('clipPath', clipPath);
                          } else {
                            selectedObject.set('clipPath', null);
                          }
                          canvas?.renderAll();
                          triggerUpdate();
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                )}
                
                {/* Alignment Guides Settings */}
                {editorMode === 'dev' && alignmentGuides && (
                  <AlignmentGuidesSettings
                    config={alignmentGuides.config}
                    onUpdate={alignmentGuides.updateConfig}
                    onToggle={alignmentGuides.toggle}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <h4 className="text-sm font-medium text-gray-700">Canvas Properties</h4>

                {editorMode === 'dev' && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-600 mb-3">Canvas Size</h5>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Width (in)</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={inchesFromPixels(canvasWidth)}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              if (Number.isFinite(parsed)) {
                                setCanvasWidth(pixelsFromInches(parsed));
                              }
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Height (in)</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={inchesFromPixels(canvasHeight)}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              if (Number.isFinite(parsed)) {
                                setCanvasHeight(pixelsFromInches(parsed));
                              }
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                      </div>

                      <button
                        onClick={updateCanvasSize}
                        className="w-full px-3 py-2 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        Update Size
                      </button>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Format</label>
                        <select
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                          onChange={(e) => {
                            if (e.target.value === 'portrait') {
                              const newWidth = Math.min(canvasWidth, canvasHeight);
                              const newHeight = Math.max(canvasWidth, canvasHeight);
                              setCanvasWidth(newWidth);
                              setCanvasHeight(newHeight);
                              updateCanvasDimensions?.(newWidth, newHeight);
                              // Force canvas to re-render all objects
                              setTimeout(() => {
                                if (canvas) {
                                  canvas.renderAll();
                                }
                              }, 50);
                            } else if (e.target.value === 'landscape') {
                              // Set landscape orientation: wider than tall
                              const newWidth = Math.max(canvasWidth, canvasHeight);
                              const newHeight = Math.min(canvasWidth, canvasHeight);
                              setCanvasWidth(newWidth);
                              setCanvasHeight(newHeight);
                              updateCanvasDimensions?.(newWidth, newHeight);
                              // Force canvas to re-render all objects
                              setTimeout(() => {
                                if (canvas) {
                                  canvas.renderAll();
                                }
                              }, 50);
                            }
                          }}
                          defaultValue="landscape"
                        >
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Landscape</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Background Styling */}
                <div>
                  <h5 className="text-sm font-medium text-gray-600 mb-3">Background</h5>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        aria-label="Background Color"
                        value={backgroundColor}
                        onChange={(e) => updateBackgroundColor(e.target.value)}
                        className="w-8 h-8 border-2 border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={backgroundColor}
                        onChange={(e) => updateBackgroundColor(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder="#ffffff"
                      />
                    </div>
                    
                    <button 
                      onClick={handleBackgroundImageUpload}
                      className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      <Upload size={16} />
                      <span>Upload Background Image</span>
                    </button>
                    
                    <button 
                      onClick={removeBackgroundImage}
                      className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      <span>Remove Background</span>
                    </button>

                    {renderMockupControls()}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;