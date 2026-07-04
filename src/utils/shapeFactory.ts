import { Text, Rect, Circle, Line, Polygon, Ellipse, FabricImage, Group } from 'fabric';
import { SHAPE_DEFAULTS } from './constants';
import { AdvancedQRCodeGenerator } from './advancedQRGenerator';
import { SHAPE_COORDINATES } from './shapeConstants';
import type { 
  ShapeConfig, 
  QRCodeOptions, 
  QRCodeFabricImage, 
  CustomPolygon, 
  CustomEllipse, 
  CustomRoundedRect 
} from '../types/canvas';

const STYLE_COLOR_DECLARATION_REGEX = /(fill|stroke|stop-color|color)\s*:\s*([^;]+)/gi;

const extractSvgColors = (svgText: string): string[] => {
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

// Default positioning constants to reduce magic numbers
const DEFAULT_POSITIONS = {
  SMALL_OFFSET: 100,
  MEDIUM_OFFSET: 150,
  LARGE_OFFSET: 200,
  POLYGON_LEFT: 250,
  POLYGON_TOP: 200,
  IMAGE_TOP: 200
} as const;

// Default dimension constants
const DEFAULT_DIMENSIONS = {
  RECT_WIDTH: 100,
  RECT_HEIGHT: 80,
  ROUNDED_RECT_WIDTH: 120,
  ROUNDED_RECT_HEIGHT: 80,
  ROUNDED_RECT_RADIUS: 15,
  CIRCLE_RADIUS: 50,
  ELLIPSE_RX: 60,
  ELLIPSE_RY: 40,
  LINE_COORDS: [50, 100, 200, 100] as const
} as const;

export class ShapeFactory {
  // Create text object
  static createText(config: Partial<ShapeConfig> = {}): Text {
    return new Text('Sample Text', {
      left: DEFAULT_POSITIONS.SMALL_OFFSET,
      top: DEFAULT_POSITIONS.SMALL_OFFSET,
      fontSize: SHAPE_DEFAULTS.TEXT_FONT_SIZE,
      fill: '#000000',
      fontFamily: SHAPE_DEFAULTS.TEXT_FONT_FAMILY,
      selectable: true,
      evented: true,
      ...config
    });
  }

  // Create rectangle object
  static createRectangle(config: Partial<ShapeConfig> = {}): Rect {
    return new Rect({
      left: DEFAULT_POSITIONS.SMALL_OFFSET,
      top: DEFAULT_POSITIONS.SMALL_OFFSET,
      width: DEFAULT_DIMENSIONS.RECT_WIDTH,
      height: DEFAULT_DIMENSIONS.RECT_HEIGHT,
      fill: '#000000',
      stroke: SHAPE_DEFAULTS.STROKE_COLOR,
      strokeWidth: SHAPE_DEFAULTS.STROKE_WIDTH,
      selectable: true,
      evented: true,
      ...config
    });
  }

  // Create circle object
  static createCircle(config: Partial<ShapeConfig> = {}): Circle {
    return new Circle({
      left: DEFAULT_POSITIONS.SMALL_OFFSET,
      top: DEFAULT_POSITIONS.SMALL_OFFSET,
      radius: DEFAULT_DIMENSIONS.CIRCLE_RADIUS,
      fill: '#000000',
      stroke: SHAPE_DEFAULTS.STROKE_COLOR,
      strokeWidth: SHAPE_DEFAULTS.STROKE_WIDTH,
      selectable: true,
      evented: true,
      ...config
    });
  }

  // Create line object
  static createLine(config: Partial<ShapeConfig> = {}): Line {
    return new Line([...DEFAULT_DIMENSIONS.LINE_COORDS], {
      stroke: SHAPE_DEFAULTS.STROKE_COLOR,
      strokeWidth: SHAPE_DEFAULTS.STROKE_WIDTH,
      selectable: true,
      evented: true,
      ...config
    });
  }

  // Create ellipse object
  static createEllipse(config: Partial<ShapeConfig> = {}): CustomEllipse {
    const ellipse = new Ellipse({
      left: DEFAULT_POSITIONS.MEDIUM_OFFSET,
      top: DEFAULT_POSITIONS.MEDIUM_OFFSET,
      rx: DEFAULT_DIMENSIONS.ELLIPSE_RX,
      ry: DEFAULT_DIMENSIONS.ELLIPSE_RY,
      fill: '#000000',
      selectable: true,
      evented: true,
      ...config
    }) as CustomEllipse;
    
    ellipse.type = 'ellipse';
    return ellipse;
  }

  // Create rounded rectangle object
  static createRoundedRectangle(config: Partial<ShapeConfig> = {}): CustomRoundedRect {
    const rect = new Rect({
      left: DEFAULT_POSITIONS.SMALL_OFFSET,
      top: DEFAULT_POSITIONS.SMALL_OFFSET,
      width: DEFAULT_DIMENSIONS.ROUNDED_RECT_WIDTH,
      height: DEFAULT_DIMENSIONS.ROUNDED_RECT_HEIGHT,
      rx: DEFAULT_DIMENSIONS.ROUNDED_RECT_RADIUS,
      ry: DEFAULT_DIMENSIONS.ROUNDED_RECT_RADIUS,
      fill: '#000000',
      selectable: true,
      evented: true,
      ...config
    }) as CustomRoundedRect;
    
    rect.type = 'rounded-rectangle';
    return rect;
  }

  // Create polygon shape
  static createPolygon(
    shapeType: keyof typeof SHAPE_COORDINATES,
    config: Partial<ShapeConfig> = {}
  ): CustomPolygon {
    const coordinates = SHAPE_COORDINATES[shapeType];
    const defaultConfig: ShapeConfig = {
      left: DEFAULT_POSITIONS.POLYGON_LEFT,
      top: DEFAULT_POSITIONS.POLYGON_TOP,
      fill: '#000000',
      selectable: true,
      evented: true,
      ...config
    };

    const polygon = new Polygon([...coordinates], defaultConfig) as CustomPolygon;
    // Set the shape type for identification
    (polygon as CustomPolygon & { type: string }).type = shapeType;
    return polygon;
  }

  // Create QR code
  static async createQRCode(
    content: string,
    type: string,
    options: QRCodeOptions = {},
    config: Partial<ShapeConfig> = {}
  ): Promise<QRCodeFabricImage> {
    try {
      // Use advanced QR code generator for better styling and features
      const svgString = await AdvancedQRCodeGenerator.generateAdvancedQRCode(content, options);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const fabricImg = new FabricImage(img, {
            left: DEFAULT_POSITIONS.SMALL_OFFSET,
            top: DEFAULT_POSITIONS.SMALL_OFFSET,
            scaleX: 1,
            scaleY: 1,
            selectable: true,
            evented: true,
            ...config
          }) as unknown as QRCodeFabricImage;
          
          // Add QR code metadata with proper typing
          fabricImg.qrCodeType = type;
          fabricImg.qrCodeContent = content;
          fabricImg.qrCodeSvg = svgString;
          fabricImg.qrCodeOptions = options;
          fabricImg.type = 'qrcode';
          
          resolve(fabricImg);
        };
        
        img.onerror = () => reject(new Error('Failed to load QR code image'));
        img.src = svgDataUrl;
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      throw new Error(`Failed to create QR code: ${errorMessage}`);
    }
  }

  // Create table object as a grouped grid
  static readonly DEFAULT_TABLE_FILL_COLOR = '#ffffff';
  static readonly DEFAULT_TABLE_STROKE_COLOR = '#111827';
  static readonly DEFAULT_TABLE_STROKE_WIDTH = 1;

  static createTable(
    rows: number,
    columns: number,
    columnWidths?: number[],
    rowHeights?: number[],
    tableStyle?: {
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
    },
    config: Partial<ShapeConfig> = {}
  ): Group {
    const safeRows = Math.max(1, Math.min(50, Math.floor(rows) || 1));
    const safeColumns = Math.max(1, Math.min(50, Math.floor(columns) || 1));

    const normalizedColumnWidths = Array.from({ length: safeColumns }, (_, index) => {
      const rawWidth = columnWidths?.[index];
      return Math.max(24, Math.floor(Number(rawWidth) || 120));
    });

    const normalizedRowHeights = Array.from({ length: safeRows }, (_, index) => {
      const rawHeight = rowHeights?.[index];
      return Math.max(24, Math.floor(Number(rawHeight) || 52));
    });

    const fillColor = tableStyle?.fillColor || ShapeFactory.DEFAULT_TABLE_FILL_COLOR;
    const strokeColor = tableStyle?.strokeColor || ShapeFactory.DEFAULT_TABLE_STROKE_COLOR;
    const strokeWidth = Math.max(0.5, Number(tableStyle?.strokeWidth) || ShapeFactory.DEFAULT_TABLE_STROKE_WIDTH);

    const width = normalizedColumnWidths.reduce((sum, current) => sum + current, 0);
    const height = normalizedRowHeights.reduce((sum, current) => sum + current, 0);

    const elements = [] as Array<Rect | Line>;

    const outerBorder = new Rect({
      left: 0,
      top: 0,
      width,
      height,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth,
      strokeUniform: true,
      selectable: false,
      evented: false,
    });
    elements.push(outerBorder);

    let xOffset = 0;
    for (let col = 0; col < safeColumns - 1; col += 1) {
      xOffset += normalizedColumnWidths[col];
      elements.push(new Line([xOffset, 0, xOffset, height], {
        stroke: strokeColor,
        strokeWidth,
        strokeUniform: true,
        selectable: false,
        evented: false,
      }));
    }

    let yOffset = 0;
    for (let row = 0; row < safeRows - 1; row += 1) {
      yOffset += normalizedRowHeights[row];
      elements.push(new Line([0, yOffset, width, yOffset], {
        stroke: strokeColor,
        strokeWidth,
        strokeUniform: true,
        selectable: false,
        evented: false,
      }));
    }

    const table = new Group(elements, {
      left: DEFAULT_POSITIONS.SMALL_OFFSET,
      top: DEFAULT_POSITIONS.SMALL_OFFSET,
      selectable: true,
      evented: true,
      ...config,
    });

    (table as any).__isTable = true;
    (table as any).__tableRows = safeRows;
    (table as any).__tableColumns = safeColumns;
    (table as any).__tableColumnWidths = normalizedColumnWidths;
    (table as any).__tableRowHeights = normalizedRowHeights;
    (table as any).__tableFillColor = fillColor;
    (table as any).__tableStrokeColor = strokeColor;
    (table as any).__tableStrokeWidth = strokeWidth;

    return table;
  }

  // Create image from file
  static createImageFromFile(file: File, config: Partial<ShapeConfig> = {}): Promise<FabricImage> {
    return new Promise(async (resolve, reject) => {
      const isSvgFile = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');

      try {
        if (isSvgFile) {
          const svgText = await file.text();
          const encodedSvg = btoa(unescape(encodeURIComponent(svgText)));
          const imgUrl = `data:image/svg+xml;base64,${encodedSvg}`;

          const img = await FabricImage.fromURL(imgUrl);
          img.scale(SHAPE_DEFAULTS.SCALE);
          img.set({
            left: DEFAULT_POSITIONS.SMALL_OFFSET,
            top: DEFAULT_POSITIONS.IMAGE_TOP,
            selectable: true,
            evented: true,
            ...config
          });

          (img as any).__isSvgUpload = true;
          (img as any).__svgSource = svgText;
          (img as any).__svgOriginalSource = svgText;
          (img as any).__svgColors = extractSvgColors(svgText);

          resolve(img);
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const imgUrl = event.target?.result as string;
          FabricImage.fromURL(imgUrl).then((img) => {
            img.scale(SHAPE_DEFAULTS.SCALE);
            img.set({
              left: DEFAULT_POSITIONS.SMALL_OFFSET,
              top: DEFAULT_POSITIONS.IMAGE_TOP,
              selectable: true,
              evented: true,
              ...config
            });
            resolve(img);
          }).catch(reject);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to read file'));
      }
    });
  }
}
