namespace egret3d {
    /**
     * 
     */
    export const enum TextureFormatEnum {
        RGBA = 1, // WebGLRenderingContext.RGBA,
        RGB = 2, // WebGLRenderingContext.RGB,
        Gray = 3, // WebGLRenderingContext.LUMINANCE,
        PVRTC4_RGB = 4,
        PVRTC4_RGBA = 4,
        PVRTC2_RGB = 4,
        PVRTC2_RGBA = 4,
    }

    /**
     * 
     */
    export class TextureReader {
        public readonly gray: boolean;
        public readonly width: number;
        public readonly height: number;
        public readonly data: Uint8Array;

        constructor(webgl: WebGLRenderingContext, texRGBA: WebGLTexture, width: number, height: number, gray: boolean = true) {
            this.gray = gray;
            this.width = width;
            this.height = height;

            let fbo = webgl.createFramebuffer();
            let fbold = webgl.getParameter(webgl.FRAMEBUFFER_BINDING);
            webgl.bindFramebuffer(webgl.FRAMEBUFFER, fbo);
            webgl.framebufferTexture2D(webgl.FRAMEBUFFER, webgl.COLOR_ATTACHMENT0, webgl.TEXTURE_2D,
                texRGBA, 0);

            let readData = new Uint8Array(this.width * this.height * 4);
            readData[0] = 2;
            webgl.readPixels(0, 0, this.width, this.height, webgl.RGBA, webgl.UNSIGNED_BYTE,
                readData);
            webgl.deleteFramebuffer(fbo);
            webgl.bindFramebuffer(webgl.FRAMEBUFFER, fbold);

            if (gray) {
                this.data = new Uint8Array(this.width * this.height);
                for (let i = 0; i < width * height; i++) {
                    this.data[i] = readData[i * 4];
                }
            } else {
                this.data = readData;
            }
        }

        getPixel(u: number, v: number): any {
            let x = (u * this.width) | 0;
            let y = (v * this.height) | 0;
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
            if (this.gray) {
                return this.data[y * this.width + x];
            }
            else {
                let i = (y * this.width + x) * 4;
                return new Color(this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]);
            }
        }
    }

    export interface ITexture {
        texture: WebGLTexture;
        width: number;
        height: number;
        isFrameBuffer(): boolean;
        dispose(webgl: WebGLRenderingContext);
        caclByteLength(): number;
    }

    export interface IRenderTarget extends ITexture {
        use(webgl: WebGLRenderingContext);
    }

    export class GlRenderTarget implements IRenderTarget {
        width: number;
        height: number;
        constructor(webgl: WebGLRenderingContext, width: number, height: number, depth: boolean = false, stencil: boolean = false) {
            this.width = width;
            this.height = height;
            this.fbo = webgl.createFramebuffer();
            webgl.bindFramebuffer(webgl.FRAMEBUFFER, this.fbo);
            if (depth || stencil) {
                this.renderbuffer = webgl.createRenderbuffer();
                webgl.bindRenderbuffer(webgl.RENDERBUFFER, this.renderbuffer);
                if (depth && stencil) {
                    webgl.renderbufferStorage(webgl.RENDERBUFFER, webgl.DEPTH_STENCIL, width, height);
                    webgl.framebufferRenderbuffer(webgl.FRAMEBUFFER, webgl.DEPTH_STENCIL_ATTACHMENT, webgl.RENDERBUFFER, this.renderbuffer);
                } else if (depth) {
                    webgl.renderbufferStorage(webgl.RENDERBUFFER, webgl.DEPTH_COMPONENT16, width, height);
                    webgl.framebufferRenderbuffer(webgl.FRAMEBUFFER, webgl.DEPTH_ATTACHMENT, webgl.RENDERBUFFER, this.renderbuffer);

                } else {
                    webgl.renderbufferStorage(webgl.RENDERBUFFER, webgl.STENCIL_INDEX8, width, height);
                    webgl.framebufferRenderbuffer(webgl.FRAMEBUFFER, webgl.STENCIL_ATTACHMENT, webgl.RENDERBUFFER, this.renderbuffer);
                }
                webgl.bindRenderbuffer(webgl.RENDERBUFFER, null);
            }

            this.texture = webgl.createTexture();
            this.fbo["width"] = width;
            this.fbo["height"] = height;

            webgl.bindTexture(webgl.TEXTURE_2D, this.texture);
            webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MAG_FILTER, webgl.LINEAR);
            webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER, webgl.LINEAR);

            webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.RGBA, width, height, 0, webgl.RGBA, webgl.UNSIGNED_BYTE, null);

            webgl.framebufferTexture2D(webgl.FRAMEBUFFER, webgl.COLOR_ATTACHMENT0, webgl.TEXTURE_2D, this.texture, 0);
        }

        fbo: WebGLFramebuffer;
        renderbuffer: WebGLRenderbuffer;
        texture: WebGLTexture;

        use(webgl: WebGLRenderingContext) {
            webgl.bindFramebuffer(webgl.FRAMEBUFFER, this.fbo);
            // webgl.bindRenderbuffer(webgl.RENDERBUFFER, this.renderbuffer);
            // webgl.bindTexture(webgl.TEXTURE_2D, this.texture);
            //webgl.framebufferTexture2D(webgl.FRAMEBUFFER, webgl.COLOR_ATTACHMENT0, webgl.TEXTURE_2D, this.texture, 0);
        }

        static useNull(webgl: WebGLRenderingContext) {
            webgl.bindFramebuffer(webgl.FRAMEBUFFER, null);

        }

        dispose(webgl: WebGLRenderingContext) {
            //if (this.texture == null && this.img != null)
            //    this.disposeit = true;
            if (this.texture != null) {
                webgl.deleteFramebuffer(this.renderbuffer);
                this.renderbuffer = null;
                webgl.deleteTexture(this.texture);
                this.texture = null;
            }
        }

        caclByteLength(): number {
            //RGBA & no mipmap
            return this.width * this.height * 4;
        }

        isFrameBuffer(): boolean {
            return true;
        }
    }

    export class GlRenderTargetCube implements IRenderTarget {
        width: number;
        height: number;
        activeCubeFace: number = 0; // PX 0, NX 1, PY 2, NY 3, PZ 4, NZ 5
        constructor(webgl: WebGLRenderingContext, width: number, height: number, depth: boolean = false, stencil: boolean = false) {
            this.width = width;
            this.height = height;
            this.fbo = webgl.createFramebuffer();
            webgl.bindFramebuffer(webgl.FRAMEBUFFER, this.fbo);
            if (depth || stencil) {
                this.renderbuffer = webgl.createRenderbuffer();
                webgl.bindRenderbuffer(webgl.RENDERBUFFER, this.renderbuffer);
                if (depth && stencil) {
                    webgl.renderbufferStorage(webgl.RENDERBUFFER, webgl.DEPTH_STENCIL, width, height);
                    webgl.framebufferRenderbuffer(webgl.FRAMEBUFFER, webgl.DEPTH_STENCIL_ATTACHMENT, webgl.RENDERBUFFER, this.renderbuffer);
                } else if (depth) {
                    webgl.renderbufferStorage(webgl.RENDERBUFFER, webgl.DEPTH_COMPONENT16, width, height);
                    webgl.framebufferRenderbuffer(webgl.FRAMEBUFFER, webgl.DEPTH_ATTACHMENT, webgl.RENDERBUFFER, this.renderbuffer);

                } else {
                    webgl.renderbufferStorage(webgl.RENDERBUFFER, webgl.STENCIL_INDEX8, width, height);
                    webgl.framebufferRenderbuffer(webgl.FRAMEBUFFER, webgl.STENCIL_ATTACHMENT, webgl.RENDERBUFFER, this.renderbuffer);
                }
                webgl.bindRenderbuffer(webgl.RENDERBUFFER, null);
            }

            this.texture = webgl.createTexture();
            this.fbo["width"] = width;
            this.fbo["height"] = height;

            webgl.bindTexture(webgl.TEXTURE_CUBE_MAP, this.texture);
            webgl.texParameteri(webgl.TEXTURE_CUBE_MAP, webgl.TEXTURE_MAG_FILTER, webgl.LINEAR);
            webgl.texParameteri(webgl.TEXTURE_CUBE_MAP, webgl.TEXTURE_MIN_FILTER, webgl.LINEAR);

            for (var i = 0; i < 6; i++) {
                webgl.texImage2D(webgl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, webgl.RGBA, width, height, 0, webgl.RGBA, webgl.UNSIGNED_BYTE, null);
            }

            webgl.framebufferTexture2D(webgl.FRAMEBUFFER, webgl.COLOR_ATTACHMENT0, webgl.TEXTURE_CUBE_MAP_POSITIVE_X + this.activeCubeFace, this.texture, 0);
        }

        fbo: WebGLFramebuffer;
        renderbuffer: WebGLRenderbuffer;
        texture: WebGLTexture;

        use(webgl: WebGLRenderingContext) {
            webgl.bindFramebuffer(webgl.FRAMEBUFFER, this.fbo);
            // webgl.bindRenderbuffer(webgl.RENDERBUFFER, this.renderbuffer);
            // webgl.bindTexture(webgl.TEXTURE_2D, this.texture);
            webgl.framebufferTexture2D(webgl.FRAMEBUFFER, webgl.COLOR_ATTACHMENT0, webgl.TEXTURE_CUBE_MAP_POSITIVE_X + this.activeCubeFace, this.texture, 0);
        }

        static useNull(webgl: WebGLRenderingContext) {
            webgl.bindFramebuffer(webgl.FRAMEBUFFER, null);
        }

        dispose(webgl: WebGLRenderingContext) {
            //if (this.texture == null && this.img != null)
            //    this.disposeit = true;
            if (this.texture != null) {
                webgl.deleteFramebuffer(this.renderbuffer);
                this.renderbuffer = null;
                webgl.deleteTexture(this.texture);
                this.texture = null;
            }
        }

        caclByteLength(): number {
            //RGBA & no mipmap
            return this.width * this.height * 4;
        }

        isFrameBuffer(): boolean {
            return true;
        }
    }

    /**
     * 
     */
    export class GlTexture2D implements ITexture {

        constructor(webgl: WebGLRenderingContext, format: TextureFormatEnum = TextureFormatEnum.RGBA, mipmap: boolean = false, linear: boolean = true) {
            this.webgl = webgl;
            this.format = format;

            this.texture = webgl.createTexture();

            // Webglkit.caps.pvrtcExtension;
        }

        uploadImage(img: HTMLImageElement, mipmap: boolean, linear: boolean, premultiply: boolean = true, repeat: boolean = false, mirroredU: boolean = false, mirroredV: boolean = false): void {
            this.width = img.width;
            this.height = img.height;
            this.mipmap = mipmap;
            this.loaded = true;
            this.webgl.pixelStorei(this.webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply ? 1 : 0);
            this.webgl.pixelStorei(this.webgl.UNPACK_FLIP_Y_WEBGL, 0);

            this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);
            let formatGL = this.webgl.RGBA;
            if (this.format == TextureFormatEnum.RGB) {
                formatGL = this.webgl.RGB;
            } else if (this.format == TextureFormatEnum.Gray) {
                formatGL = this.webgl.LUMINANCE;
            }
            this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, formatGL, formatGL, this.webgl.UNSIGNED_BYTE, img);
            if (mipmap) {
                this.webgl.generateMipmap(this.webgl.TEXTURE_2D);

                if (linear) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.LINEAR);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR_MIPMAP_LINEAR);
                } else {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.NEAREST);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.NEAREST_MIPMAP_NEAREST);
                }
            } else {
                if (linear) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.LINEAR);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR);
                } else {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.NEAREST);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.NEAREST);

                }
            }

            if (repeat) {
                if (mirroredU && mirroredV) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.MIRRORED_REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.MIRRORED_REPEAT);
                } else if (mirroredU) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.MIRRORED_REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.REPEAT);
                } else if (mirroredV) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.MIRRORED_REPEAT);
                } else {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.REPEAT);
                }
            } else {
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.CLAMP_TO_EDGE);
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.CLAMP_TO_EDGE);
            }
        }

        uploadByteArray(mipmap: boolean, linear: boolean, width: number, height: number, data: Uint8Array, repeat: boolean = false, mirroredU: boolean = false, mirroredV: boolean = false): void {
            this.width = width;
            this.height = height;
            this.mipmap = mipmap;
            this.loaded = true;
            this.webgl.pixelStorei(this.webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
            this.webgl.pixelStorei(this.webgl.UNPACK_FLIP_Y_WEBGL, 0);

            this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);
            let formatGL = this.webgl.RGBA;
            if (this.format == TextureFormatEnum.RGB) {
                formatGL = this.webgl.RGB;
            } else if (this.format == TextureFormatEnum.Gray) {
                formatGL = this.webgl.LUMINANCE;
            }
            this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, formatGL, width, height, 0, formatGL, this.webgl.UNSIGNED_BYTE, data);
            if (mipmap) {
                this.webgl.generateMipmap(this.webgl.TEXTURE_2D);

                if (linear) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.LINEAR);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR_MIPMAP_LINEAR);
                } else {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.NEAREST);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.NEAREST_MIPMAP_NEAREST);
                }
            } else {
                if (linear) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.LINEAR);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR);
                }
                else {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.NEAREST);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.NEAREST);

                }
            }

            if (repeat) {
                if (mirroredU && mirroredV) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.MIRRORED_REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.MIRRORED_REPEAT);
                } else if (mirroredU) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.MIRRORED_REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.REPEAT);
                } else if (mirroredV) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.MIRRORED_REPEAT);
                } else {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.REPEAT);
                }
            } else {
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.CLAMP_TO_EDGE);
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.CLAMP_TO_EDGE);
            }
        }

        webgl: WebGLRenderingContext;
        //img: HTMLImageElement = null;
        loaded: boolean = false;
        texture: WebGLTexture;
        format: TextureFormatEnum;
        width: number = 0;
        height: number = 0;
        mipmap: boolean = false;

        caclByteLength(): number {
            let pixellen = 1;
            if (this.format == TextureFormatEnum.RGBA) {
                pixellen = 4;
            }
            else if (this.format == TextureFormatEnum.RGB) {
                pixellen = 3;
            }
            let len = this.width * this.height * pixellen;
            if (this.mipmap) {
                len = len * (1 - Math.pow(0.25, 10)) / 0.75;
            }
            return len;
        }

        // 创建读取器，有可能失败
        reader: TextureReader;

        getReader(redOnly: boolean = false): TextureReader {
            if (this.reader != null) {
                if (this.reader.gray != redOnly)
                    throw new Error("get param diff with this.reader");
                return this.reader;
            }
            if (this.format != TextureFormatEnum.RGBA)
                throw new Error("only rgba texture can read");
            if (this.texture == null) return null;
            if (this.reader == null)
                this.reader = new TextureReader(this.webgl, this.texture, this.width, this.height, redOnly);

            return this.reader;
        }

        //disposeit: boolean = false;

        dispose(webgl: WebGLRenderingContext) {
            //if (this.texture == null && this.img != null) this.disposeit = true;

            if (this.texture != null) {
                webgl.deleteTexture(this.texture);
                this.texture = null;
            }
        }

        isFrameBuffer(): boolean {
            return false;
        }

        private static mapTexture: { [id: string]: GlTexture2D } = {};

        static formGrayArray(webgl: WebGLRenderingContext, array: number[] | Float32Array | Float64Array, width: number, height: number) {
            let mipmap = false;
            let linear = true;
            let t = new GlTexture2D(webgl, TextureFormatEnum.RGBA, mipmap, linear);
            let data = new Uint8Array(array.length * 4);
            for (let y = 0; y < width; y++) {
                for (let x = 0; x < width; x++) {
                    let fi = y * 512 + x;
                    let i = y * width + x;
                    data[fi * 4] = array[i] * 255;
                    data[fi * 4 + 1] = array[i] * 255;
                    data[fi * 4 + 2] = array[i] * 255;
                    data[fi * 4 + 3] = 255;
                }
            }

            t.uploadByteArray(mipmap, linear, 512, 512, data);

            return t;
        }

        static staticTexture(webgl: WebGLRenderingContext, name: string) {
            let t = GlTexture2D.mapTexture[name];
            if (t != undefined)
                return t;


            let mipmap = false;
            let linear = true;
            t = new GlTexture2D(webgl, TextureFormatEnum.RGBA, mipmap, linear);

            let data = new Uint8Array(4);
            let width = 1;
            let height = 1;
            data[0] = 128;
            data[1] = 0;
            data[2] = 128;
            data[3] = 255;
            if (name == "gray") {
                data[0] = 128;
                data[1] = 128;
                data[2] = 128;
                data[3] = 255;
            } else if (name == "white") {
                data[0] = 255;
                data[1] = 255;
                data[2] = 255;
                data[3] = 255;
            } else if (name == "black") {
                data[0] = 0;
                data[1] = 0;
                data[2] = 0;
                data[3] = 255;
            } else if (name == "grid") {
                width = 256;
                height = 256;
                data = new Uint8Array(width * width * 4);
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        let seek = (y * width + x) * 4;

                        if (((x - width * 0.5) * (y - height * 0.5)) > 0) {
                            data[seek] = 0;
                            data[seek + 1] = 0;
                            data[seek + 2] = 0;
                            data[seek + 3] = 255;
                        }
                        else {
                            data[seek] = 255;
                            data[seek + 1] = 255;
                            data[seek + 2] = 255;
                            data[seek + 3] = 255;
                        }
                    }
                }

            }

            t.uploadByteArray(mipmap, linear, width, height, data);

            GlTexture2D.mapTexture[name] = t;
            return t;
        }
    }

    /**
     * 
     */
    export class WriteableTexture2D implements ITexture {
        constructor(webgl: WebGLRenderingContext, format: TextureFormatEnum = TextureFormatEnum.RGBA, width: number, height: number, linear: boolean, premultiply: boolean = true, repeat: boolean = false, mirroredU: boolean = false, mirroredV: boolean = false) {
            this.webgl = webgl;

            this.texture = webgl.createTexture();

            this.webgl.pixelStorei(this.webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply ? 1 : 0);
            this.webgl.pixelStorei(this.webgl.UNPACK_FLIP_Y_WEBGL, 0);

            this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);
            this.format = format;
            this.formatGL = this.webgl.RGBA;

            if (format == TextureFormatEnum.RGB) {
                this.formatGL = this.webgl.RGB;
            } else if (format == TextureFormatEnum.Gray) {
                this.formatGL = this.webgl.LUMINANCE;
            }

            let data: Uint8Array = null;

            this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, this.formatGL, width, height, 0, this.formatGL, this.webgl.UNSIGNED_BYTE, data);
            if (linear) {
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.LINEAR);
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR);
            } else {
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MAG_FILTER, this.webgl.NEAREST);
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.NEAREST);
            }
            if (repeat) {
                if (mirroredU && mirroredV) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.MIRRORED_REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.MIRRORED_REPEAT);
                } else if (mirroredU) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.MIRRORED_REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.REPEAT);
                } else if (mirroredV) {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.MIRRORED_REPEAT);
                } else {
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.REPEAT);
                    this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.REPEAT);
                }
            } else {
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.CLAMP_TO_EDGE);
                this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.CLAMP_TO_EDGE);
            }
        }

        linear: boolean;
        premultiply: boolean = true;
        repeat: boolean = false;
        mirroredU: boolean = false;
        mirroredV: boolean = false

        updateRect(data: Uint8Array, x: number, y: number, width: number, height: number) {
            this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);

            this.webgl.texSubImage2D(this.webgl.TEXTURE_2D, 0, x, y, width, height, this.formatGL, this.webgl.UNSIGNED_BYTE, data);
        }

        updateRectImg(data: ImageData | HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, x: number, y: number) {
            this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);
            this.webgl.texSubImage2D(this.webgl.TEXTURE_2D, 0, x, y, this.formatGL, this.webgl.UNSIGNED_BYTE, data);
        }

        isFrameBuffer(): boolean {
            return false;
        }

        webgl: WebGLRenderingContext;
        texture: WebGLTexture;
        format: TextureFormatEnum;
        formatGL: number;
        width: number = 0;
        height: number = 0;

        dispose(webgl: WebGLRenderingContext) {
            if (this.texture != null) {
                webgl.deleteTexture(this.texture);
                this.texture = null;
            }
        }

        caclByteLength(): number {
            let pixellen = 1;
            if (this.format == TextureFormatEnum.RGBA) {
                pixellen = 4;
            } else if (this.format == TextureFormatEnum.RGB) {
                pixellen = 3;
            }
            let len = this.width * this.height * pixellen;
            return len;
        }
    }
}