import { useState, useRef, useEffect, useCallback } from 'react';
import { FabricImage } from 'fabric';
import { AdvancedQRCodeGenerator } from './utils/advancedQRGenerator';
import './App.css';

type CanvasFormat = 'portrait' | 'landscape';

interface CanvasDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  format: CanvasFormat;
  data: string | null;
}

interface EmbeddedCanvasPayload {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  format?: CanvasFormat;
  data?: string | Record<string, unknown> | null;
}

interface EmbeddedProjectPayload {
  canvases?: EmbeddedCanvasPayload[];
  activeCanvasId?: string;
  version?: number;
}

interface EmbeddedMessage {
  type: string;
  requestId?: string;
  payload?: unknown;
}

const EMBED_COMMANDS = {
  LOAD_PROJECT: 'fabric-editor:load-project',
  LOAD_TEMPLATE_COPY: 'fabric-editor:load-template-copy',
  EXPORT_PROJECT: 'fabric-editor:export-project',
  GET_PROJECT: 'fabric-editor:get-project',
  PROJECT_LOADED: 'fabric-editor:project-loaded',
  PROJECT_EXPORTED: 'fabric-editor:project-exported',
  PROJECT_UPDATED: 'fabric-editor:project-updated',
  ERROR: 'fabric-editor:error',
} as const;

// Components
import Header from './components/Header';
import LeftSidebar from './components/LeftSidebar';
import CanvasWrapper from './components/CanvasWrapper';
import RightSidebar from './components/RightSidebar';
import BottomToolbar from './components/BottomToolbar';
import QRCodeDialog from './components/QRCodeDialog';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';

// Hooks
import { useCanvasManager } from './hooks/useCanvasManager';
import { useShapeCreator } from './hooks/useShapeCreator';
import { useCanvasKeyboardShortcuts } from './hooks/useCanvasKeyboardShortcuts';

// Utils
import { CanvasExporter, CanvasAligner, CanvasGroupManager } from './utils/canvasUtils';
import { CANVAS_DEFAULTS } from './utils/constants';

// Types
import type { CanvasDimensions } from './types/canvas';

// Styles
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingExternalProjectRef = useRef<EmbeddedProjectPayload | null>(null);
  const bridgeAttachedRef = useRef(false);
  
  // Canvas management hook
  const {
    canvasState,
    canvasObjects,
    currentCanvasLayer,
    canGroup,
    canUngroup,
    canUndo,
    canRedo,
    undo,
    redo,
    addObjectToCanvas,
    selectObject,
    toggleObjectVisibility,
    deleteObject,
    toggleCanvasLayer,
    updateCanvasObjects,
    updateCanvasAndSaveHistory,
    setCanvasState,
    alignmentGuides,
  } = useCanvasManager(canvasRef);

  // Shape creation hook
  const {
    addText,
    addRectangle,
    addCircle,
    addLine,
    addEllipse,
    addRoundedRectangle,
    addTriangle,
    addPentagon,
    addHexagon,
    addStar,
    addDiamond,
    addHeart,
    addArrow,
    addCloud,
    addLightning,
    addSpeechBubble,
    addCross,
    addParallelogram,
    addTrapezoid,
    addOctagonShape,
    addQRCode,
    addImage,
  } = useShapeCreator(canvasState.canvas, addObjectToCanvas);

  // UI state
  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({ 
    width: CANVAS_DEFAULTS.WIDTH, 
    height: CANVAS_DEFAULTS.HEIGHT 
  });
  const [canvasFormat, setCanvasFormat] = useState<CanvasFormat>('landscape');
  const [canvasDocuments, setCanvasDocuments] = useState<CanvasDocument[]>([
    {
      id: 'canvas-1',
      name: 'Front',
      width: CANVAS_DEFAULTS.WIDTH,
      height: CANVAS_DEFAULTS.HEIGHT,
      format: 'landscape',
      data: null,
    }
  ]);
  const [activeCanvasId, setActiveCanvasId] = useState<string>('canvas-1');
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [canvasSwitchingEnabled, setCanvasSwitchingEnabled] = useState<boolean>(false);
  const [isQRCodeDialogOpen, setIsQRCodeDialogOpen] = useState<boolean>(false);
  const [isKeyboardShortcutsModalOpen, setIsKeyboardShortcutsModalOpen] = useState<boolean>(false);

  // Keyboard shortcuts
  const keyboardShortcuts = useCanvasKeyboardShortcuts(canvasState.canvas, {
    enabled: true,
    enableClipboard: true,
    onObjectUpdate: updateCanvasAndSaveHistory,
    onUndo: undo,
    onRedo: redo
  });

  // Register the '?' shortcut to open shortcuts modal
  useEffect(() => {
    if (keyboardShortcuts) {
      keyboardShortcuts.registerShortcut({
        key: '?',
        action: () => setIsKeyboardShortcutsModalOpen(true),
        description: 'Show keyboard shortcuts',
        category: 'Help'
      });
    }
  }, [keyboardShortcuts]);

  // Canvas utilities - initialized when canvas is available
  const getCanvasExporter = () => canvasState.canvas ? new CanvasExporter(canvasState.canvas as any) : null;
  const getCanvasAligner = () => canvasState.canvas ? new CanvasAligner(canvasState.canvas as any) : null;
  const getGroupManager = () => canvasState.canvas ? new CanvasGroupManager(canvasState.canvas as any) : null;

  const serializeCurrentCanvas = useCallback(() => {
    if (!canvasState.canvas) return null;
    return JSON.stringify(canvasState.canvas.toJSON());
  }, [canvasState.canvas]);

  const persistActiveCanvas = useCallback((nextDimensions?: CanvasDimensions, nextFormat?: CanvasFormat) => {
    const serializedData = serializeCurrentCanvas();
    if (!serializedData) return;

    setCanvasDocuments(prev => prev.map(doc => {
      if (doc.id !== activeCanvasId) return doc;

      return {
        ...doc,
        width: nextDimensions?.width ?? canvasDimensions.width,
        height: nextDimensions?.height ?? canvasDimensions.height,
        format: nextFormat ?? canvasFormat,
        data: serializedData,
      };
    }));
  }, [activeCanvasId, canvasDimensions.height, canvasDimensions.width, canvasFormat, serializeCurrentCanvas]);

  const normalizeCanvasPayload = useCallback((payload: EmbeddedCanvasPayload, index: number): CanvasDocument => {
    const width = payload.width && payload.width > 0 ? payload.width : CANVAS_DEFAULTS.WIDTH;
    const height = payload.height && payload.height > 0 ? payload.height : CANVAS_DEFAULTS.HEIGHT;
    const format: CanvasFormat = payload.format || (width >= height ? 'landscape' : 'portrait');

    let data: string | null = null;
    if (typeof payload.data === 'string') {
      data = payload.data;
    } else if (payload.data && typeof payload.data === 'object') {
      data = JSON.stringify(payload.data);
    }

    return {
      id: `canvas-${index + 1}`,
      name: (payload.name || '').trim() || (index === 0 ? 'Front' : `Canvas ${index + 1}`),
      width,
      height,
      format,
      data,
    };
  }, []);

  const normalizeProjectPayload = useCallback((input: unknown): EmbeddedProjectPayload => {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input) as EmbeddedProjectPayload;
      } catch {
        return { canvases: [] };
      }
    }

    if (Array.isArray(input)) {
      return { canvases: input as EmbeddedCanvasPayload[] };
    }

    if (input && typeof input === 'object') {
      const asProject = input as EmbeddedProjectPayload;
      if (Array.isArray(asProject.canvases)) {
        return asProject;
      }

      return { canvases: [input as EmbeddedCanvasPayload] };
    }

    return { canvases: [] };
  }, []);

  const buildProjectSnapshot = useCallback(() => {
    const serializedCurrent = serializeCurrentCanvas();
    const mergedDocuments = canvasDocuments.map(doc => {
      if (doc.id !== activeCanvasId) return doc;

      return {
        ...doc,
        width: canvasDimensions.width,
        height: canvasDimensions.height,
        format: canvasFormat,
        data: serializedCurrent ?? doc.data,
      };
    });

    return {
      version: 1,
      activeCanvasId,
      canvases: mergedDocuments,
      exportedAt: new Date().toISOString(),
    };
  }, [activeCanvasId, canvasDimensions.height, canvasDimensions.width, canvasDocuments, canvasFormat, serializeCurrentCanvas]);

  const loadCanvasDocument = useCallback(async (target: CanvasDocument) => {
    if (!canvasState.canvas) return;

    const canvas = canvasState.canvas;
    const nextDimensions = { width: target.width, height: target.height };

    setCanvasDimensions(nextDimensions);
    setCanvasFormat(target.format);

    canvas.setDimensions(nextDimensions);
    if (canvasRef.current) {
      canvasRef.current.width = target.width;
      canvasRef.current.height = target.height;
    }

    canvas.discardActiveObject();
    if (target.data) {
      await canvas.loadFromJSON(target.data);
    } else {
      canvas.clear();
      canvas.backgroundColor = CANVAS_DEFAULTS.BACKGROUND_COLOR;
    }

    canvas.renderAll();
    setCanvasState(prev => ({ ...prev, selectedObject: null }));
    updateCanvasObjects();
  }, [canvasState.canvas, setCanvasState, updateCanvasObjects]);

  const applyExternalProject = useCallback(async (input: unknown) => {
    const normalized = normalizeProjectPayload(input);
    const sourceCanvases = normalized.canvases || [];

    if (!sourceCanvases.length) {
      throw new Error('No canvases found in project payload.');
    }

    const loadedDocuments = sourceCanvases.map((canvasPayload, index) =>
      normalizeCanvasPayload(canvasPayload, index)
    );

    const desiredActiveId = loadedDocuments.find(doc => doc.id === normalized.activeCanvasId)?.id
      || loadedDocuments[0].id;

    setCanvasDocuments(loadedDocuments);
    setActiveCanvasId(desiredActiveId);

    const activeDocument = loadedDocuments.find(doc => doc.id === desiredActiveId) || loadedDocuments[0];
    await loadCanvasDocument(activeDocument);
  }, [loadCanvasDocument, normalizeCanvasPayload, normalizeProjectPayload]);

  // Canvas dimension management
  const updateCanvasDimensions = (width: number, height: number) => {
    if (!canvasState.canvas) return;

    const nextDimensions = { width, height };
    setCanvasDimensions(nextDimensions);
    canvasState.canvas.setDimensions({ width, height });
    canvasState.canvas.renderAll();
    
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }

    persistActiveCanvas(nextDimensions, width >= height ? 'landscape' : 'portrait');
  };

  const updateCanvasDimensionsFromCanvas = (dimensions: CanvasDimensions) => {
    updateCanvasDimensions(dimensions.width, dimensions.height);
  };

  const handleToggleCanvasSwitching = (enabled: boolean) => {
    setCanvasSwitchingEnabled(enabled);
  };

  const handleCanvasCountChange = useCallback((count: number, newCanvasName?: string) => {
    const boundedCount = Math.max(1, Math.min(20, count));
    const requestedName = (newCanvasName || '').trim();

    setCanvasDocuments(prev => {
      if (boundedCount === prev.length) return prev;

      if (boundedCount < prev.length) {
        const next = prev.slice(0, boundedCount);
        if (!next.some(doc => doc.id === activeCanvasId)) {
          setActiveCanvasId(next[0].id);
        }
        return next;
      }

      const additions: CanvasDocument[] = [];
      let customNameIndex = 1;
      for (let index = prev.length + 1; index <= boundedCount; index += 1) {
        const generatedName = requestedName
          ? (customNameIndex === 1 ? requestedName : `${requestedName} ${customNameIndex}`)
          : `Canvas ${index}`;

        additions.push({
          id: `canvas-${index}`,
          name: generatedName,
          width: canvasDimensions.width,
          height: canvasDimensions.height,
          format: canvasFormat,
          data: null,
        });

        customNameIndex += 1;
      }
      return [...prev, ...additions];
    });
  }, [activeCanvasId, canvasDimensions.height, canvasDimensions.width, canvasFormat]);

  const handleCanvasFormatChange = useCallback((format: CanvasFormat) => {
    if (format === canvasFormat) return;

    let nextWidth = canvasDimensions.width;
    let nextHeight = canvasDimensions.height;

    if (format === 'portrait' && nextWidth > nextHeight) {
      nextWidth = canvasDimensions.height;
      nextHeight = canvasDimensions.width;
    }

    if (format === 'landscape' && nextHeight > nextWidth) {
      nextWidth = canvasDimensions.height;
      nextHeight = canvasDimensions.width;
    }

    setCanvasFormat(format);
    updateCanvasDimensions(nextWidth, nextHeight);
    persistActiveCanvas({ width: nextWidth, height: nextHeight }, format);
  }, [canvasDimensions.height, canvasDimensions.width, canvasFormat, persistActiveCanvas]);

  const handleSwitchCanvas = useCallback(async (canvasId: string) => {
    if (canvasId === activeCanvasId) return;

    persistActiveCanvas();
    const target = canvasDocuments.find(doc => doc.id === canvasId);
    if (!target) return;

    await loadCanvasDocument(target);
    setActiveCanvasId(canvasId);
  }, [activeCanvasId, canvasDocuments, loadCanvasDocument, persistActiveCanvas]);

  useEffect(() => {
    if (!canvasState.canvas) return;

    const activeDoc = canvasDocuments.find(doc => doc.id === activeCanvasId);
    if (!activeDoc) return;

    if (activeDoc.data === null) {
      persistActiveCanvas();
    }
  }, [activeCanvasId, canvasDocuments, canvasState.canvas, persistActiveCanvas]);

  useEffect(() => {
    if (!canvasDocuments.some(doc => doc.id === activeCanvasId) && canvasDocuments[0]) {
      void handleSwitchCanvas(canvasDocuments[0].id);
    }
  }, [activeCanvasId, canvasDocuments, handleSwitchCanvas]);

  useEffect(() => {
    if (!canvasState.canvas || !pendingExternalProjectRef.current) return;

    const pending = pendingExternalProjectRef.current;
    pendingExternalProjectRef.current = null;
    void applyExternalProject(pending);
  }, [applyExternalProject, canvasState.canvas]);

  useEffect(() => {
    const postHostMessage = (type: string, payload: unknown, requestId?: string) => {
      window.parent?.postMessage({ type, payload, requestId }, '*');
    };

    const exportProject = () => buildProjectSnapshot();

    const loadProject = async (payload: unknown) => {
      if (!canvasState.canvas) {
        pendingExternalProjectRef.current = normalizeProjectPayload(payload);
        return;
      }

      await applyExternalProject(payload);
    };

    const onMessage = (event: MessageEvent) => {
      const message = event.data as EmbeddedMessage;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return;
      }

      if (message.type === EMBED_COMMANDS.LOAD_PROJECT || message.type === EMBED_COMMANDS.LOAD_TEMPLATE_COPY) {
        loadProject(message.payload)
          .then(() => {
            postHostMessage(EMBED_COMMANDS.PROJECT_LOADED, { success: true }, message.requestId);
          })
          .catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load project.';
            postHostMessage(EMBED_COMMANDS.ERROR, { message: errorMessage }, message.requestId);
          });
      }

      if (message.type === EMBED_COMMANDS.EXPORT_PROJECT || message.type === EMBED_COMMANDS.GET_PROJECT) {
        const project = exportProject();
        postHostMessage(EMBED_COMMANDS.PROJECT_EXPORTED, project, message.requestId);
      }
    };

    window.addEventListener('message', onMessage);

    if (!bridgeAttachedRef.current) {
      (window as any).fabricDesignToolBridge = {
        loadProject,
        loadTemplateCopy: loadProject,
        exportProject,
      };
      bridgeAttachedRef.current = true;

      const initialPayload = (window as any).__FABRIC_EDITOR_INITIAL_PROJECT__;
      if (initialPayload) {
        void loadProject(initialPayload);
      }
    }

    return () => {
      window.removeEventListener('message', onMessage);
      if ((window as any).fabricDesignToolBridge) {
        delete (window as any).fabricDesignToolBridge;
      }
      bridgeAttachedRef.current = false;
    };
  }, [applyExternalProject, buildProjectSnapshot, canvasState.canvas, normalizeProjectPayload]);

  useEffect(() => {
    if (!canvasState.canvas) return;

    const snapshot = buildProjectSnapshot();
    window.parent?.postMessage({
      type: EMBED_COMMANDS.PROJECT_UPDATED,
      payload: snapshot,
    }, '*');
  }, [buildProjectSnapshot, canvasDocuments, canvasObjects, canvasState.canvas]);

  // QR Code dialog handlers
  const handleOpenQRCodeDialog = () => {
    setIsQRCodeDialogOpen(true);
  };

  const handleCloseQRCodeDialog = () => {
    setIsQRCodeDialogOpen(false);
  };

  const handleGenerateQRCode = (content: string, type: string, options: any) => {
    addQRCode(type, content, options);
    setIsQRCodeDialogOpen(false);
  };

  // QR Code color update function
  const updateQRCodeColors = async (qrObject: FabricImage, foregroundColor: string, backgroundColor: string) => {
    if (!canvasState.canvas) return;
    
    try {
      const content = (qrObject as any).qrCodeContent;
      const options = (qrObject as any).qrCodeOptions || {};
      
      if (!content) return;
      
      // Update the QR options with new colors
      const updatedOptions = {
        ...options,
        dotsOptions: {
          ...options.dotsOptions,
          color: foregroundColor
        },
        backgroundOptions: {
          ...options.backgroundOptions,
          color: backgroundColor
        },
        cornersSquareOptions: {
          ...options.cornersSquareOptions,
          color: foregroundColor
        },
        cornersDotOptions: {
          ...options.cornersDotOptions,
          color: foregroundColor
        },
        color: { dark: foregroundColor, light: backgroundColor } // Legacy compatibility
      };
      
      const svgString = await AdvancedQRCodeGenerator.generateAdvancedQRCode(content, updatedOptions);
      const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
      
      const img = new Image();
      img.onload = () => {
        const left = qrObject.left;
        const top = qrObject.top;
        const scaleX = qrObject.scaleX;
        const scaleY = qrObject.scaleY;
        const angle = qrObject.angle;
        
        (qrObject as any).setSrc(svgDataUrl, {
          crossOrigin: 'anonymous'
        }).then(() => {
          qrObject.set({ left, top, scaleX, scaleY, angle });
          
          (qrObject as any).qrCodeSvg = svgString;
          (qrObject as any).qrCodeOptions = updatedOptions;
          
          canvasState.canvas!.renderAll();
        }).catch(() => {
          // Error loading image
        });
      };
      
      img.src = svgDataUrl;
    } catch {
      // Error generating QR code
    }
  };

  // Export function
  const handleExport = (format: string) => {
    const exporter = getCanvasExporter();
    if (exporter) {
      exporter.export(format as any);
    }
  };

  // Alignment function
  const handleAlignObjects = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const aligner = getCanvasAligner();
    if (aligner) {
      aligner.align(alignment);
    }
  };

  // Group/Ungroup functions
  const handleGroupObjects = () => {
    const groupManager = getGroupManager();
    if (groupManager) {
      groupManager.groupObjects();
    }
  };

  const handleUngroupObjects = () => {
    const groupManager = getGroupManager();
    if (groupManager) {
      groupManager.ungroupObjects();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header 
        selectedTool={selectedTool}
        onToolSelect={setSelectedTool}
        onAddText={addText}
        onAddRectangle={addRectangle}
        onAddLine={addLine}
        onAddImage={addImage}
        onAddCircle={addCircle}
        onAddTriangle={addTriangle}
        onAddPentagon={addPentagon}
        onAddHexagon={addHexagon}
        onAddStar={addStar}
        onAddEllipse={addEllipse}
        onAddArrow={addArrow}
        onAddRoundedRectangle={addRoundedRectangle}
        onAddDiamond={addDiamond}
        onAddHeart={addHeart}
        onAddCloud={addCloud}
        onAddLightning={addLightning}
        onAddSpeechBubble={addSpeechBubble}
        onAddCross={addCross}
        onAddParallelogram={addParallelogram}
        onAddTrapezoid={addTrapezoid}
        onAddOctagonShape={addOctagonShape}
        onAddQRCode={handleOpenQRCodeDialog}
        onExport={handleExport}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onAlignObjects={handleAlignObjects}
        onGroupObjects={handleGroupObjects}
        onUngroupObjects={handleUngroupObjects}
        canGroup={canGroup}
        canUngroup={canUngroup}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar 
          objects={canvasObjects}
          onSelectObject={selectObject}
          onToggleVisibility={toggleObjectVisibility}
          onDeleteObject={deleteObject}
        />
        
        <div className="flex-1 flex flex-col relative">
          <CanvasWrapper 
            canvasRef={canvasRef}
            canvas={canvasState.canvas}
            zoom={canvasState.zoom}
            canvasDimensions={canvasDimensions}
            onZoomChange={(zoom: number) => setCanvasState(prev => ({ ...prev, zoom }))}
            onCanvasDimensionsChange={updateCanvasDimensionsFromCanvas}
          />
          
          <BottomToolbar 
            zoom={canvasState.zoom}
            onZoomChange={(zoom: number) => setCanvasState(prev => ({ ...prev, zoom }))}
            onToggleCanvasLayer={toggleCanvasLayer}
            currentLayer={currentCanvasLayer}
            canvasSwitchingEnabled={canvasSwitchingEnabled}
            onToggleCanvasSwitching={handleToggleCanvasSwitching}
            canvases={canvasDocuments.map(doc => ({ id: doc.id, name: doc.name }))}
            activeCanvasId={activeCanvasId}
            onSwitchCanvas={(canvasId: string) => {
              void handleSwitchCanvas(canvasId);
            }}
            onShowKeyboardShortcuts={() => setIsKeyboardShortcutsModalOpen(true)}
          />
        </div>
        
        <RightSidebar 
          selectedObject={canvasState.selectedObject}
          canvas={canvasState.canvas}
          canvasDimensions={canvasDimensions}
          updateCanvasObjects={updateCanvasObjects}
          updateCanvasDimensions={updateCanvasDimensions}
          canvasCount={canvasDocuments.length}
          onCanvasCountChange={handleCanvasCountChange}
          canvasFormat={canvasFormat}
          onCanvasFormatChange={handleCanvasFormatChange}
          updateQRCodeColors={updateQRCodeColors}
          onObjectUpdate={updateCanvasObjects}
          alignmentGuides={alignmentGuides}
        />
      </div>

      {/* QR Code Dialog */}
      <QRCodeDialog
        isOpen={isQRCodeDialogOpen}
        onClose={handleCloseQRCodeDialog}
        onGenerate={handleGenerateQRCode}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsModalOpen}
        onClose={() => setIsKeyboardShortcutsModalOpen(false)}
        shortcuts={keyboardShortcuts?.getShortcuts() || []}
      />
    </div>
  );
}

export default App;
