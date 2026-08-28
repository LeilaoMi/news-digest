// 每日时事简报 Worker — 部署在 Cloudflare
// 数据源：微博热搜 + 多源 RSS（含 Google新闻聚合）+ Workers AI 增强总结
// 推送：Server酱（微信"服务通知"）
// 存储：KV
// 触发：Cron（每日 23:00 UTC = 07:00 Asia/Shanghai）
// v3: 2026-08-27 全量 — 扩展新闻源(5→7可靠源+RFI)、切换中文更强的免费AI(deepseek/qwq/gpt-oss)、增加超时重试与回退+清理think标签

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// ---- Embedded QRCode generator (kazuhikoarase/qrcode-generator 1.4.4 MIT) ----
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));


function renderQRToSvgPath(text, size=160, margin=8) {
  try {
    let qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cell = (size - margin*2) / count;
    let path = "";
    for(let r=0; r<count; r++){
      for(let c=0; c<count; c++){
        if(qr.isDark(r,c)){
          const x = Math.round(c*cell + margin);
          const y = Math.round(r*cell + margin);
          const s = Math.ceil(cell);
          path += `M${x},${y}h${s}v${s}h-${s}z`;
        }
      }
    }
    return { path, count };
  } catch(e){ console.log("qr err", e); return { path: "", count: 0 }; }
}

// === 扩展后新闻源：聚合1条顶10家 + 垂直源 ===
const RSS_FEEDS = [
  { name: "BBC中文",   url: "https://feeds.bbci.co.uk/zhongwen/simp/rss.xml" },
  { name: "DW中文",    url: "https://rss.dw.com/rdf/rss-chi-all" },
  { name: "NYT中文网", url: "https://cn.nytimes.com/rss/zh-hant/" },
  { name: "FT中文",    url: "https://www.ftchinese.com/rss/news" },
  { name: "RFA中文",   url: "https://www.rfa.org/mandarin/rss2.xml" },
  { name: "RFI中文",   url: "https://www.rfi.fr/cn/rss" },
  { name: "Solidot",  url: "https://www.solidot.org/index.rss" },
];

// === CF上免费且中文最强的模型，按优先级回退 ===
// 主力 deepseek-32b 中文理解+去八卦最强，免费额度内约180 Neurons/次
// 备选 qwq-32b 推理强不编造，约170 Neurons
// 兜底 gpt-oss-20b 指令最稳且最快最省(90 Neurons)
const AI_MODELS_PRIMARY = [
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "@cf/qwen/qwq-32b",
  "@cf/openai/gpt-oss-20b",
];
// 兼容旧变量，实际使用 AI_MODELS_PRIMARY
const AI_MODEL = AI_MODELS_PRIMARY[0];

// ---------- HTTP handler ----------

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    const q = url.searchParams;
    const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
    if (req.method === "OPTIONS") return new Response("", { headers: corsHeaders });
    if (path === "/") return showIndex(env);
    if (path === "/health") return showHealth(env);
    if (path.startsWith("/d/")) return showDigest(env, path.slice(3));
    if (path === "/trigger") {
      const key = q.get("key");
      if (!key || key !== env.TRIGGER_KEY) return new Response("unauthorized", { status: 401 });
      const edition = q.get("edition") || "morning";
      ctx.waitUntil(runDigest(env, { manual: true, edition }));
      return new Response("triggered " + edition + "\n", { status: 202 });
    }
    if (path === "/rss.xml" || path === "/feed.xml") { const r=await showRss(env); Object.entries(corsHeaders).forEach(([k,v])=>r.headers.set(k,v)); return r; }
    if (path === "/feed.json") { const r=await showFeedJson(env); Object.entries(corsHeaders).forEach(([k,v])=>r.headers.set(k,v)); return r; }
    if (path === "/api/latest") { const r=await showApiLatest(env); Object.entries(corsHeaders).forEach(([k,v])=>r.headers.set(k,v)); return r; }
    if (path.startsWith("/api/d/")) { const r=await showApiDigest(env, path.slice(7)); Object.entries(corsHeaders).forEach(([k,v])=>r.headers.set(k,v)); return r; }
    if (path === "/api/search") { const r=await showSearch(env, q.get("q")||"", q.get("limit")||"20"); Object.entries(corsHeaders).forEach(([k,v])=>r.headers.set(k,v)); return r; }
    if (path === "/api/timeline") { const r=await showTimeline(env, q); Object.entries(corsHeaders).forEach(([k,v])=>r.headers.set(k,v)); return r; }
    if (path === "/api/stats") { const r=await showStats(env); Object.entries(corsHeaders).forEach(([k,v])=>r.headers.set(k,v)); return r; }
    if (path === "/api/ask" && req.method === "POST") return handleAsk(req, env);
    if (path === "/ask") return handleAskGet(env, q.get("q")||"", q.get("date")||"");
    if (path.startsWith("/card/")) return showCard(env, path.slice(6));
    if (path.startsWith("/weekly/")) return showWeekly(env, path.slice(8));
    if (path === "/weekly" || path === "/api/weekly") return showWeeklyLatest(env);
    if (path === "/ai/v1/chat/completions" && req.method === "POST") return aiChatCompletions(req, env);
    if (path === "/ai/v1/models") return aiModels(req, env);
    return new Response("not found", { status: 404 });
  },
  async scheduled(event, env, ctx) {
    const cron = event.cron || "";
    const hour = new Date(event.scheduledTime || Date.now()).getUTCHours();
    const day = new Date(event.scheduledTime || Date.now()).getUTCDay();
    if (cron.includes("2 * * 1")) {
      ctx.waitUntil(runWeekly(env));
    } else if (hour === 11) {
      ctx.waitUntil(runDigest(env, { manual: false, edition: "evening" }));
    } else {
      ctx.waitUntil(runDigest(env, { manual: false, edition: "morning" }));
      if (day === 1) ctx.waitUntil(runWeekly(env));
    }
  },
};

// ---------- Core: run digest ----------

async function runDigest(env, { manual, edition="morning" }) {
  const startedAt = Date.now();
  const today = todayShanghai();
  const id = edition === "evening" ? today + "-evening" : today;
  let weibo = [];
  let feedResults = [];
  let status = { edition, errors: [] };
  try {
    [weibo, feedResults] = await Promise.all([
      fetchWeiboHot().catch((e) => { status.errors.push("weibo:"+String(e).slice(0,120)); return []; }),
      Promise.all(RSS_FEEDS.map((f) =>
        fetchRss(f.name, f.url).catch((e) => ({ name: f.name, items: [], error: String(e).slice(0, 200) }))
      )),
    ]);
  } catch (e) { status.errors.push(String(e).slice(0,200)); }
  let scored = [];
  try { scored = dedupAndScore(feedResults); } catch(e){ scored = []; }
  let bodiesMap = new Map();
  try { bodiesMap = await fetchArticleBodies(feedResults, 10); } catch(e){ console.log("bodies err", e); }
  let context = "";
  try { context = buildPromptContext(weibo, feedResults, bodiesMap, scored); } catch(e){ context = buildPromptContext(weibo, feedResults); }
  const summary = await aiSummarize(env, context);
  const record = {
    id,
    date: today,
    edition,
    generated_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    weibo_count: weibo.length,
    feed_count: feedResults.reduce((s, f) => s + f.items.length, 0),
    scored_count: scored.length,
    bodies_fetched: bodiesMap.size,
    summary_md: summary,
    sources: { weibo: weibo.slice(0, 30), feeds: feedResults.map((f) => ({ name: f.name, items: f.items.slice(0, 10), error: f.error })), },
  };
  await env.KV.put(`digest:${id}`, JSON.stringify(record));
  if (edition === "morning") { await env.KV.put(`digest:${today}`, JSON.stringify(record)); }
  await env.KV.put("digest:latest", id);
  const indexRaw = await env.KV.get("digest:index");
  const index = indexRaw ? JSON.parse(indexRaw) : [];
  if (!index.includes(id)) {
    if (edition === "morning" && index.includes(today)) { const pos = index.indexOf(today); index[pos]=id; } else index.unshift(id);
    if (index.length > 120) index.length = 120;
    await env.KV.put("digest:index", JSON.stringify(index));
  }
  status.duration_ms = record.duration_ms;
  status.feed_count = record.feed_count;
  status.bodies = bodiesMap.size;
  status.generated_at = record.generated_at;
  await env.KV.put(`digest:status:${id}`, JSON.stringify(status));
  try { await saveToD1(env, record, scored, bodiesMap); } catch(e){}
  try { await archiveToR2(env, record); } catch(e){}
  const baseUrl = env.PUBLIC_BASE_URL || "https://news.leilaomi.cc.cd";
  const tag = edition === "evening" ? "evening" : "morning";
  const desp = buildWeChatBody(record, baseUrl);
  try { await pushServerChan(env.SERVERCHAN_SENDKEY, "news " + today + " " + tag, desp); } catch (e) { console.log("server chan push err", e); }
  return record;
}

// ---------- Source: Weibo hot search ----------

async function fetchWeiboHot() {
  const res = await fetch("https://weibo.com/ajax/side/hotSearch", {
    headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://weibo.com/" },
    cf: { cacheTtl: 0 },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`weibo HTTP ${res.status}`);
  const data = await res.json();
  const list = data?.data?.realtime || [];
  return list
    .filter((x) => x && x.word)
    .slice(0, 30)
    .map((x, i) => ({
      rank: i + 1,
      word: x.word,
      note: x.note || x.word,
      label: x.label_name || "",
      num: x.num || 0,
      url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(x.word)}%23`,
    }));
}

// ---------- Source: RSS ----------

async function fetchRss(name, url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*" },
    cf: { cacheTtl: 0 },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`${name} HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseRss(xml).slice(0, 15);
  return { name, items };
}

function parseRss(xml) {
  const items = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/g;
  const matches = xml.match(itemRe) || [];
  const now = Date.now();
  for (const block of matches) {
    const title = extractTag(block, "title");
    if (!title) continue;
    const link = extractTag(block, "link") || extractAttr(block, "link", "href");
    const desc = extractTag(block, "description") || extractTag(block, "content:encoded") || "";
    const pubRaw =
      extractTag(block, "pubDate") ||
      extractTag(block, "dc:date") ||
      extractTag(block, "published") ||
      extractTag(block, "updated") ||
      "";
    let pub = 0;
    if (pubRaw) {
      const t = Date.parse(pubRaw);
      if (!isNaN(t)) pub = t;
    }
    items.push({
      title: clean(title),
      link: clean(link),
      desc: clean(desc).slice(0, 280),
      pubDate: pubRaw,
      pubTs: pub,
    });
  }
  items.sort((a, b) => b.pubTs - a.pubTs);
  // Prefer items from the last 48h
  const recent = items.filter((i) => i.pubTs > 0 && now - i.pubTs < 48 * 3600 * 1000);
  return recent.length >= 5 ? recent : items;
}

function extractTag(xml, tag) {
  const re = new RegExp("<"+tag+"[^>]*>([\\s\\S]*?)<\\/"+tag+">", "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}
function extractAttr(xml, tag, attr) {
  const idx = xml.indexOf("<"+tag);
  if(idx===-1) return "";
  const snippet = xml.slice(idx, idx+600);
  const re = new RegExp(attr+"\\s*=\\s*[\"\']([^\"\']+)[\"\']", "i");
  const m = snippet.match(re);
  return m ? m[1] : "";
}function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clean(s) {
  if (!s) return "";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- AI summary with fallback ----------

function buildPromptContext(weibo, feedResults, bodiesMap=null, scored=null) {
  const lines = [];
  lines.push("【国内·微博热搜（前 30）】");
  if (weibo.length === 0) {
    lines.push("(抓取失败)");
  } else {
    weibo.forEach((w) => {
      const tag = w.label ? `[${w.label}]` : "";
      lines.push(`${w.rank}. ${w.word} ${tag}`);
    });
  }
  lines.push("");
  for (const f of feedResults) {
    lines.push(`【国外·${f.name}】`);
    if (f.error) {
      lines.push(`(抓取失败: ${f.error})`);
    } else if (f.items.length === 0) {
      lines.push("(本时段无新文章)");
    } else {
      f.items.slice(0, 8).forEach((it, i) => {
        lines.push(`${i + 1}. ${it.title}`);
        if (it.desc) lines.push(`   ${it.desc.slice(0, 180)}`);
      });
    }
    lines.push("");
  }
  if (bodiesMap && bodiesMap.size>0) {
    lines.push("【深度正文摘要】");
    let c=0; for(const [url, body] of bodiesMap){ if(c++>=6) break; lines.push(`- ${body.slice(0,600).replace(/\n/g," ")}`); }
    lines.push("");
  }
  if (scored && scored.length){ lines.push("【排序后TOP】"); scored.slice(0,12).forEach((it,i)=> lines.push(`${i+1}. [${it.source}] ${it.title} (score:${(it._score||0).toFixed(1)})`)); lines.push(""); }
  return lines.join("\n");
}

async function aiSummarize(env, context) {
  const today = todayShanghai();
  const systemPrompt = `你是一位资深时事编辑，给一位关注民生、政策、社会公平、经济动向的读者撰写每日简报。
要求：
1. 一律使用简体中文，语气克制、客观、不煽情、不空话。
2. 区分国内（微博热搜映射的舆论焦点）和国外（外媒报道）。
3. 重点关注与民生强相关的信息：物价、就业、社保、住房、医疗、教育、地方治理、安全事件、重大政策。
4. 娱乐八卦、明星绯闻、纯营销词条一律忽略。
5. 输出格式必须是 Markdown，分以下板块：

# ${today} 时事简报

## 🇨🇳 国内舆论焦点
（从微博热搜里挑 5-8 条有公共意义的，每条一行：词条 + 一句话解释为什么值得关注。忽略娱乐八卦）

## 🌏 国际重要进展
（按 BBC/DW/NYT/FT/RFA等报道，挑 5-8 条与中国、地缘、经济、人权相关的，每条一行）

## 🔍 值得深读
（推荐 2-3 篇你认为最有信息密度的报道，给出标题 + 简短理由）

## 📌 一句话总结
（用一句话概括今天的时代切片）

不要解释你的思考过程，直接输出 Markdown 内容。尽量基于信息源汇总，不编造。`;

  const userPrompt = `今日（${today}）信息源汇总：\n\n${context}\n\n请按系统指令格式化为简报。`;

  // 依次尝试多个免费中文强模型，回退保证成功率
  const modelsToTry = env.AI_MODEL ? [env.AI_MODEL, ...AI_MODELS_PRIMARY.filter(m=>m!==env.AI_MODEL)] : AI_MODELS_PRIMARY;
  // 去重
  const uniqModels = [...new Set(modelsToTry)];

  for (const model of uniqModels) {
    try {
      console.log(`try ai model ${model}`);
      const r = await env.AI.run(model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2800,
        temperature: 0.32,
      });
      let out = (r && (r.response || r.result?.response || r.choices?.[0]?.message?.content)) || "";
      if (typeof out !== "string") out = JSON.stringify(out);
      out = out.trim();
      // clean deepseek think tags and fence
      out = out.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      out = out.replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```\s*$/g, "").trim();
      if (out && out.length > 200) {
        console.log(`ai model ${model} ok, len=${out.length}`);
        return out;
      }
      console.log(`ai model ${model} empty/short, try next`);
    } catch (e) {
      console.log(`ai model ${model} failed:`, String(e).slice(0,500));
    }
  }
  return "（AI 返回为空，请稍后重试或检查 AI 模型配额）";
}

// ---------- AI proxy: OpenAI-compatible chat completions ----------
const AI_MODELS = [
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "@cf/qwen/qwq-32b",
  "@cf/openai/gpt-oss-20b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/google/gemma-3-12b-it",
];

function aiAuthOk(req, env) {
  if (!env.AI_PROXY_KEY) return false;
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return false;
  return h.slice(7) === env.AI_PROXY_KEY;
}

async function aiModels(req, env) {
  if (!aiAuthOk(req, env)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  return Response.json({
    object: "list",
    data: AI_MODELS.map((id) => ({ id: id.replace(/^@cf\//, ""), object: "model", owned_by: "cloudflare", created: 0 })),
  });
}

async function aiChatCompletions(req, env) {
  if (!aiAuthOk(req, env)) {
    return new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: "invalid json" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Normalise model id: strip "openai/" prefix that LiteLLM adds, restore "@cf/" if missing.
  let model = String(body.model || AI_MODELS_PRIMARY[0]);
  model = model.replace(/^openai\//, "");
  if (!model.startsWith("@cf/")) model = "@cf/" + model;

  const messages = body.messages || [];
  const maxTokens = Math.min(Number(body.max_tokens || 2048), 4096);
  const temperature = body.temperature ?? 0.4;

  try {
    const r = await env.AI.run(model, { messages, max_tokens: maxTokens, temperature });

    // env.AI.run may return either { response: "..." } or OpenAI-shaped { choices: [...] }
    let content = "";
    if (r && typeof r === "object") {
      if (typeof r.response === "string") content = r.response;
      else if (r.choices && r.choices[0]?.message?.content) content = r.choices[0].message.content;
      else content = JSON.stringify(r);
    } else {
      content = String(r ?? "");
    }

    const now = Math.floor(Date.now() / 1000);
    return Response.json({
      id: "chatcmpl-" + crypto.randomUUID(),
      object: "chat.completion",
      created: now,
      model: model.replace(/^@cf\//, ""),
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: String(e) } }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

// ---------- WeChat push (Server酱) ----------

function buildWeChatBody(record, baseUrl) {
  const tail = `\n\n---\n\n🔗 [查看完整简报](${baseUrl}/d/${record.id})  \n📚 [历史归档](${baseUrl}/)  \n\n*抓取耗时 ${(record.duration_ms / 1000).toFixed(1)}s · 微博热搜 ${record.weibo_count} 条 · 外媒 ${record.feed_count} 篇*`;
  return record.summary_md + tail;
}

async function pushServerChan(sendKey, title, desp) {
  if (!sendKey) throw new Error("no SERVERCHAN_SENDKEY");
  const body = new URLSearchParams({ title, desp });
  const res = await fetch(`https://sctapi.ftqq.com/${sendKey}.send`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`server chan HTTP ${res.status}: ${txt.slice(0, 200)}`);
  return txt;
}



// ---------- Deep fetch: article bodies ----------
async function fetchArticleBodies(feedResults, limit=10) {
  const flat = [];
  for (const f of feedResults) for (const it of (f.items||[]).slice(0,4)) flat.push({ ...it, source: f.name });
  const seen = new Set();
  const uniq = [];
  for (const a of flat) { if (!a.link || seen.has(a.link)) continue; seen.add(a.link); uniq.push(a); }
  const kw = /\u4e2d\u56fd|\u7f8e\u56fd|\u7ecf\u6d4e|\u653f\u7b56|\u6c11\u751f|\u5b89\u5168|\u5c31\u4e1a|\u623f|\u533b\u7597|\u6559\u80b2|\u53f0\u6e7e|\u9999\u6e2f/;
  uniq.sort((a,b)=>{
    let sa = kw.test(a.title)?1:0; let sb = kw.test(b.title)?1:0;
    if (sa!==sb) return sb-sa;
    return (b.pubTs||0)-(a.pubTs||0);
  });
  const top = uniq.slice(0, limit);
  const results = await Promise.all(top.map(async (it)=>{
    try {
      const res = await fetch(it.link, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000), cf:{cacheTtl:0} });
      if (!res.ok) return { url: it.link, title: it.title, body: "" };
      const html = await res.text();
      const body = extractArticleText(html).slice(0, 3500);
      return { url: it.link, title: it.title, body, source: it.source };
    } catch(e){ return { url: it.link, title: it.title, body: "" }; }
  }));
  const map = new Map();
  for (const r of results) if (r.body) map.set(r.url, r.body);
  return map;
}
function extractArticleText(html){
  if (!html) return "";
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  let m = t.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (m) t = m[1];
  else { let mm = t.match(/<main[^>]*>([\s\S]*?)<\/main>/i); if (mm) t = mm[1]; }
  const ps = [...t.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(x=>clean(x[1])).filter(s=>s.length>20);
  if (ps.length>=2) return ps.join("\n\n").slice(0,6000);
  return clean(t.replace(/<[^>]+>/g, " ")).slice(0,6000);
}

// ---------- Scoring & dedup ----------
function dedupAndScore(feedResults){
  const all=[];
  for(const f of feedResults) for(const it of f.items||[]) all.push({ ...it, source:f.name });
  const seenTitle=new Set();
  const uniq=[];
  for(const it of all){
    const norm = it.title.replace(/[^\p{L}\p{N}]/gu,"").toLowerCase().slice(0,20);
    if(seenTitle.has(norm)) continue;
    seenTitle.add(norm);
    uniq.push(it);
  }
  const kwScore = (title)=>{
    let s=0;
    if(/\u4e2d\u56fd|\u53f0\u6e7e|\u9999\u6e2f|\u5317\u4eac|\u4e0a\u6d77/.test(title)) s+=1;
    if(/\u7ecf\u6d4e|\u653f\u7b56|\u6c11\u751f|\u5b89\u5168|\u533b\u7597|\u623f|\u5c31\u4e1a|\u6559\u80b2|\u5236\u88c1|\u9009\u4e3e/.test(title)) s+=1.5;
    if(/\u660e\u661f|\u7efc\u827a|\u5267\u96c6/.test(title)) s-=2;
    return s;
  };
  uniq.forEach(it=>{ it._score = kwScore(it.title) + (it.pubTs> Date.now()-12*3600*1000 ? 0.8:0); });
  uniq.sort((a,b)=> (b._score - a._score) || (b.pubTs - a.pubTs));
  return uniq;
}

// ---------- D1 / R2 helpers ----------
async function saveToD1(env, record, scoredItems, bodiesMap){
  if(!env.DB) return;
  try{
    const date = record.date;
    await env.DB.prepare("INSERT OR REPLACE INTO digests (date, summary_md, generated_at, duration_ms, weibo_count, feed_count) VALUES (?,?,?,?,?,?)").bind(date, record.summary_md, record.generated_at, record.duration_ms, record.weibo_count, record.feed_count).run();
    const stmts = [];
    for(const it of scoredItems.slice(0,40)){
      const id = date + "|" + (it.link||it.title).slice(0,80);
      const body = bodiesMap.get(it.link) || "";
      stmts.push(env.DB.prepare("INSERT OR REPLACE INTO items (id, date, title, link, source, pubTs, score, tag, body) VALUES (?,?,?,?,?,?,?,?,?)").bind(id, date, it.title, it.link, it.source, it.pubTs||0, Math.round((it._score||0)*10), it.tag||"", body.slice(0,3000)));
    }
    if(stmts.length && env.DB.batch) await env.DB.batch(stmts);
    else for(const s of stmts) await s.run();
  } catch(e){ console.log("D1 save err", e); }
}
async function archiveToR2(env, record){
  if(!env.ARCHIVE) return;
  try{
    const key = "digests/" + record.date + ".json";
    await env.ARCHIVE.put(key, JSON.stringify(record), { httpMetadata:{ contentType:"application/json; charset=utf-8" }});
  } catch(e){ console.log("R2 err", e); }
}

// ---------- RSS / Feed / API ----------
async function showRss(env){
  const idxRaw = await env.KV.get("digest:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const items = [];
  for(const id of idx.slice(0,20)){
    const raw = await env.KV.get("digest:"+id);
    if(!raw) continue;
    const r = JSON.parse(raw);
    const desc = (r.summary_md||"").split("\n").slice(0,8).join(" ").slice(0,500).replace(/[#*]/g,"");
    items.push({ id:r.id, summary:desc, date:r.generated_at });
  }
  let publicBase = "https://news.leilaomi.cc.cd";
  if(env.PUBLIC_BASE_URL) publicBase = env.PUBLIC_BASE_URL;
  const xmlItems = items.map(it=>`
  <item>
    <title><![CDATA[${it.id} \u65f6\u4e8b\u7b80\u62a5]]></title>
    <link>${publicBase}/d/${it.id}</link>
    <guid>${publicBase}/d/${it.id}</guid>
    <pubDate>${new Date(it.date).toUTCString()}</pubDate>
    <description><![CDATA[${escHtml(it.summary)}]]></description>
  </item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>\u65f6\u4e8b\u7b80\u62a5</title>\n<link>${publicBase}/</link>\n<description>\u6bcf\u65e5 07:00 \u81ea\u52a8\u63a8\u9001 \u00b7 \u5fae\u535a+7\u6e90RSS \u00b7 Workers AI \u603b\u7ed3</description>\n<language>zh-CN</language>\n${xmlItems}\n</channel></rss>`;
  return new Response(xml, { headers:{ "Content-Type":"application/rss+xml; charset=utf-8", "Cache-Control":"max-age=600" } });
}
async function showFeedJson(env){
  const idxRaw = await env.KV.get("digest:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const items=[];
  for(const id of idx.slice(0,20)){
    const raw = await env.KV.get("digest:"+id);
    if(!raw) continue;
    const r=JSON.parse(raw);
    items.push({ id: "https://news.leilaomi.cc.cd/d/"+r.id, url: "https://news.leilaomi.cc.cd/d/"+r.id, title: r.id + " \u65f6\u4e8b\u7b80\u62a5", content_text: r.summary_md, date_published: r.generated_at, });
  }
  const feed = { version:"https://jsonfeed.org/version/1.1", title:"\u65f6\u4e8b\u7b80\u62a5", home_page_url:"https://news.leilaomi.cc.cd/", feed_url:"https://news.leilaomi.cc.cd/feed.json", items };
  return Response.json(feed, { headers:{ "Cache-Control":"max-age=600" }});
}
async function showApiLatest(env){
  const latest = await env.KV.get("digest:latest");
  if(!latest) return Response.json({ error:"no data" }, { status:404 });
  const raw = await env.KV.get("digest:"+latest);
  return new Response(raw, { headers:{ "Content-Type":"application/json; charset=utf-8", "Cache-Control":"max-age=300", "Access-Control-Allow-Origin":"*" }});
}
async function showApiDigest(env, id){
  if(!/^\d{4}-\d{2}-\d{2}/.test(id) && !/^\d{4}-\d{2}-\d{2}-evening$/.test(id)) return new Response("bad id", { status:400 });
  const raw = await env.KV.get("digest:"+id);
  if(!raw) return new Response("not found", { status:404 });
  return new Response(raw, { headers:{ "Content-Type":"application/json; charset=utf-8", "Cache-Control":"max-age=600", "Access-Control-Allow-Origin":"*" }});
}
async function showSearch(env, q, limitStr){
  const limit = Math.min(parseInt(limitStr)||20, 50);
  if(!q) return Response.json({ query:q, results:[] });
  const idxRaw = await env.KV.get("digest:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const results=[];
  const needle = q.toLowerCase();
  for(const id of idx.slice(0,60)){
    if(results.length>=limit) break;
    const raw = await env.KV.get("digest:"+id);
    if(!raw) continue;
    const r=JSON.parse(raw);
    const hay = (r.summary_md + " " + JSON.stringify(r.sources)).toLowerCase();
    if(hay.includes(needle)){
      const idxPos = hay.indexOf(needle);
      const snippet = r.summary_md.slice(Math.max(0, idxPos-80), idxPos+200).replace(/\n/g," ");
      results.push({ date: r.id, snippet: snippet.slice(0,300), generated_at: r.generated_at });
    }
  }
  if(env.DB && results.length < limit){
    try{
      const rs = await env.DB.prepare("SELECT date, title, link, source FROM items WHERE title LIKE ? OR body LIKE ? ORDER BY pubTs DESC LIMIT ?").bind("%"+q+"%","%"+q+"%", limit).all();
      for(const row of rs.results||[]){
        if(results.length>=limit) break;
        if(!results.find(x=>x.date===row.date)) results.push({ date: row.date, snippet: row.title, link: row.link, source: row.source });
      }
    }catch(e){}
  }
  return Response.json({ query:q, count: results.length, results });
}
async function showTimeline(env, params){
  const days = Math.min(parseInt(params.get("days")||"7"), 30);
  const tag = params.get("tag")||"";
  const q = params.get("q")||"";
  const idxRaw = await env.KV.get("digest:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const out=[];
  for(const id of idx.slice(0, days)){
    const raw = await env.KV.get("digest:"+id);
    if(!raw) continue;
    const r=JSON.parse(raw);
    let include=true;
    if(tag && !r.summary_md.includes(tag)) include=false;
    if(q && !r.summary_md.toLowerCase().includes(q.toLowerCase())) include=false;
    if(include) out.push({ date:r.id, generated_at:r.generated_at, duration_ms:r.duration_ms, weibo_count:r.weibo_count, feed_count:r.feed_count, one_liner: (r.summary_md.match(/\u4e00\u53e5\u8bdd\u603b\u7ed3[\s\S]*?\\n(.+)/)||["",""])[1]?.slice(0,200) || r.summary_md.split("\n").slice(-2).join(" ").slice(0,200) });
  }
  return Response.json({ days, tag, q, count: out.length, items: out });
}
async function showStats(env){
  const idxRaw = await env.KV.get("digest:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const latest = await env.KV.get("digest:latest");
  let status=null;
  if(latest){ const raw=await env.KV.get("digest:"+latest); if(raw){ const r=JSON.parse(raw); status={ date:r.id, generated_at:r.generated_at, duration_ms:r.duration_ms }; } }
  let d1Count=null;
  if(env.DB) try{ const r=await env.DB.prepare("SELECT COUNT(*) as c FROM items").first(); d1Count=r.c; }catch(e){ d1Count="err:"+String(e).slice(0,100); }
  return Response.json({ index_count: idx.length, latest, status, d1_items: d1Count, has_r2: !!env.ARCHIVE, has_d1: !!env.DB, rss_feeds: RSS_FEEDS.map(f=>f.name) });
}
async function handleAsk(req, env){
  let body={};
  try{ body=await req.json(); }catch(e){ return Response.json({ error:"invalid json"},{status:400}); }
  const q = (body.q || body.question || "").toString().slice(0,500);
  const date = (body.date || "").toString().slice(0,10);
  if(!q) return Response.json({ error:"q required" },{status:400});
  return askCore(env, q, date);
}
async function handleAskGet(env, q, date){
  if(!q) return Response.json({ error:"q required, use /ask?q=...&date=YYYY-MM-DD" },{status:400});
  return askCore(env, q, date);
}
async function askCore(env, q, date){
  let context="";
  let digestId = date;
  if(!digestId){ digestId = await env.KV.get("digest:latest"); }
  if(digestId){
    const raw = await env.KV.get("digest:"+digestId);
    if(raw){
      const r=JSON.parse(raw);
      context = "\u603b\u7ed3:\\n" + (r.summary_md||"").slice(0,6000) + "\\n\\n\u8be6\u60c5\\n" + JSON.stringify(r.sources).slice(0,8000);
      if(env.DB){
        try{
          const rs=await env.DB.prepare("SELECT title, body FROM items WHERE date=? ORDER BY score DESC LIMIT 8").bind(digestId).all();
          if(rs.results && rs.results.length) context += "\\n\\n\u6b63\u6587:"+ rs.results.map(x=> x.title+":"+ (x.body||"").slice(0,800)).join("\\n");
        }catch(e){}
      }
    }
  }
  if(!context) context = "\u6682\u65e0\u5f53\u65e5\u7b80\u62a5\u6570\u636e";
  const sys = "\u4f60\u662f\u65f6\u4e8b\u7b80\u62a5\u52a9\u624b\u3002\u53ea\u57fa\u4e8e\u3010\u4e0a\u4e0b\u6587\u3011\u56de\u7b54\u7528\u6237\u63d0\u95ee\u3002\u4e0d\u7f16\u9020\u3002\u5982\u679c\u4e0a\u4e0b\u6587\u6ca1\u6709\u7b54\u6848\u5c31\u8bf4\u6682\u65f6\u627e\u4e0d\u5230\u76f8\u5173\u4fe1\u606f\u3002\u4e00\u5f8b\u7b80\u4f53\u4e2d\u6587\u3002";
  for(const m of AI_MODELS_PRIMARY){
    try{
      const r=await env.AI.run(m, { messages:[{role:"system", content:sys},{role:"user", content:"\u3010\u4e0a\u4e0b\u6587\u3011\\n"+context+"\\n\\n\u3010\u95ee\u9898\u3011"+q}], max_tokens:1200, temperature:0.3 });
      let out = r.response || r.result?.response || "";
      if(typeof out!=="string") out=JSON.stringify(out);
      out=out.replace(/<think>[\s\S]*?<\/think>/gi,"").trim();
      if(out) return Response.json({ date: digestId, q, answer: out });
    }catch(e){}
  }
  return Response.json({ error:"ai failed" },{status:500});
}
async function showCard(env, idRaw){
  let id = idRaw.replace(/\.svg$/,"").trim().replace(/\.png$/,"").trim();
  if(!/^\d{4}-\d{2}-\d{2}/.test(id) && !/^\d{4}-\d{2}-\d{2}-evening$/.test(id)) id = await env.KV.get("digest:latest") || "";
  const raw = id ? await env.KV.get("digest:"+id) : null;
  const rec = raw ? JSON.parse(raw) : null;
  const title = id + " \u65f6\u4e8b\u7b80\u62a5";
  let lines = [];
  if(rec && rec.summary_md){
    const rawLines = rec.summary_md.split(/\r?\n/).map(s=>s.trim());
    // First try bullet style (new format: "- **..." or "1. ...")
    lines = rawLines.filter(l=>l.startsWith("-")||/^\d+[\.、]/.test(l)).map(l=>l.replace(/^[-*]\s*/,"").replace(/^\d+[\.、]\s*/,"").replace(/\*\*/g,"").trim()).filter(Boolean);
    // Fallback: extract meaningful paragraphs (old format has no bullets)
    if(lines.length===0){
      lines = rawLines.filter(l=>l && !l.startsWith("#") && !l.startsWith("---") && l.length>12 && !l.startsWith("##") && l !== rec.id + " \u65f6\u4e8b\u7b80\u62a5").map(l=>l.replace(/\*\*/g,"").replace(/^[-*\d\.、\s]+/,"").trim()).filter(Boolean);
      // Remove section headers themselves if they slipped through
      lines = lines.filter(l=>!l.startsWith("\u56fd\u5185") && !l.startsWith("\u56fd\u9645") && !l.startsWith("\u503c\u5f97") && !l.startsWith("\u4e00\u53e5\u8bdd"));
    }
    lines = lines.slice(0,4);
    if(lines.length===0) lines = ["\u6682\u65e0\u53ef\u663e\u793a\u5185\u5bb9"];
  } else {
    lines = ["\u6682\u65e0\u6570\u636e"];
  }
  let baseUrl = "https://news.leilaomi.cc.cd";
  try{ if(env.PUBLIC_BASE_URL) baseUrl = env.PUBLIC_BASE_URL; }catch(e){}
  const url = baseUrl + "/d/" + id;
  const qr = renderQRToSvgPath(url, 160, 10);
  const qrSvg = qr.path ? `<g><rect x="960" y="460" width="160" height="160" rx="12" fill="#ffffff" stroke="#e8e3d8"/><path d="${qr.path}" fill="#1a1a1a" transform="translate(960,460)"/><rect x="960" y="460" width="160" height="160" rx="12" fill="none" stroke="#e8e3d8"/></g><text x="1040" y="640" text-anchor="middle" font-size="12" fill="#9c958b">\u626b\u7801\u67e5\u770b</text>` : `<g><rect x="960" y="460" width="160" height="100" rx="12" fill="#faf8f3" stroke="#e8e3d8"/><text x="1040" y="515" text-anchor="middle" font-size="14" fill="#9c958b">QR</text></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" rx="24" fill="#faf8f3"/>
  <rect x="24" y="24" width="1152" height="582" rx="16" fill="#ffffff" stroke="#e8e3d8"/>
  <text x="60" y="90" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="44" font-weight="700" fill="#1a1a1a">${escHtml(title)}</text>
  <text x="60" y="130" font-family="sans-serif" font-size="18" fill="#6b6b6b">${escHtml(rec? rec.generated_at.slice(0,16).replace("T"," ")+" \u00b7 \u6bcf\u65e5 07:00 \u66f4\u65b0":"")}</text>
  ${lines.map((l,i)=>`<text x="60" y="${190+i*70}" font-family="sans-serif" font-size="22" fill="#1a1a1a"><tspan>${escHtml(l.slice(0,56))}</tspan></text>`).join("")}
  <text x="60" y="560" font-family="sans-serif" font-size="16" fill="#c0392b">${escHtml(baseUrl.replace(/^https?:\/\//,''))}  \u00b7  \u626b\u7801\u67e5\u770b\u5b8c\u6574\u7248</text>
  ${qrSvg}
</svg>`;
  return new Response(svg, { headers:{ "Content-Type":"image/svg+xml; charset=utf-8", "Cache-Control":"max-age=3600" }});
}
async function showWeekly(env, weekId){
  if(!weekId || weekId==="latest") return showWeeklyLatest(env);
  const raw = await env.KV.get("weekly:"+weekId);
  if(!raw) return new Response("weekly not found", { status:404 });
  const rec=JSON.parse(raw);
  const html = pageShell(weekId+" \u5468\u62a5", `<header><a href="/" class="back">\u2190 \u5f52\u6863</a><p class="meta">\u751f\u6210\u4e8e ${new Date(rec.generated_at).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})}</p></header><main><article class="digest">${mdToHtml(rec.summary_md)}</article></main>`);
  return new Response(html, { headers:{ "Content-Type":"text/html; charset=utf-8" }});
}
async function showWeeklyLatest(env){
  const idxRaw = await env.KV.get("weekly:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  if(idx.length===0) return new Response("\u6682\u65e0\u5468\u62a5", { status:404 });
  return showWeekly(env, idx[0]);
}
async function runWeekly(env){
  const idxRaw = await env.KV.get("digest:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const last7 = idx.slice(0,7);
  if(last7.length<3) return;
  const digests=[];
  for(const id of last7){ const raw=await env.KV.get("digest:"+id); if(raw) digests.push(JSON.parse(raw)); }
  const context = digests.map(d=> `## ${d.id}\\n${d.summary_md.slice(0,2000)}`).join("\\n\\n");
  const sys = "\u4f60\u662f\u65f6\u4e8b\u7f16\u8f91\u3002\u8bf7\u57fa\u4e8e\u8fd17\u65e5\u7b80\u62a5\u751f\u6210\u4e00\u4efd\u5468\u62a5\u3002\u683c\u5f0f:\\n# \u5468\u62a5 \\n## \u672c\u5468\u5927\u4e8b\\n## \u6301\u7eed\u5173\u6ce8\\n## \u6570\u636e\u4e00\u89c8\\n";
  let out="";
  for(const m of AI_MODELS_PRIMARY){
    try{
      const r=await env.AI.run(m, { messages:[{role:"system", content:sys},{role:"user", content:context}], max_tokens:2400, temperature:0.3 });
      out = r.response || ""; if(typeof out!=="string") out=JSON.stringify(out);
      out=out.replace(/<think>[\s\S]*?<\/think>/gi,"").trim();
      if(out.length>300) break;
    }catch(e){}
  }
  if(!out) return;
  const weekId = last7[0] + "_W";
  const rec={ id:weekId, dates:last7, generated_at:new Date().toISOString(), summary_md:out };
  await env.KV.put("weekly:"+weekId, JSON.stringify(rec));
  const wIdxRaw=await env.KV.get("weekly:index"); const wIdx = wIdxRaw? JSON.parse(wIdxRaw):[];
  if(!wIdx.includes(weekId)){ wIdx.unshift(weekId); if(wIdx.length>20) wIdx.length=20; await env.KV.put("weekly:index", JSON.stringify(wIdx)); }
  if(env.ARCHIVE) try{ await env.ARCHIVE.put("weekly/"+weekId+".json", JSON.stringify(rec), { httpMetadata:{ contentType:"application/json" }}); }catch(e){}
}
async function showHealth(env){
  const idxRaw = await env.KV.get("digest:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const latest = await env.KV.get("digest:latest");
  let latestRec=null;
  if(latest){ const raw=await env.KV.get("digest:"+latest); if(raw) latestRec=JSON.parse(raw); }
  const feedHealth = latestRec ? latestRec.sources.feeds.map(f=>({name:f.name, count:f.items?.length||0, error:f.error||null})) : [];
  const weeklyIdxRaw = await env.KV.get("weekly:index");
  const weeklyIdx = weeklyIdxRaw ? JSON.parse(weeklyIdxRaw) : [];
  let d1Count=null, r2Ok=false;
  if(env.DB) try{ const r=await env.DB.prepare("SELECT COUNT(*) as c FROM items").first(); d1Count=r.c; }catch(e){ d1Count="err:"+String(e).slice(0,100); }
  if(env.ARCHIVE) r2Ok=true;
  return Response.json({
    ok:true,
    time: new Date().toISOString(),
    latest, index_count: idx.length, weekly_count: weeklyIdx.length,
    latest_duration_ms: latestRec?.duration_ms||null,
    latest_feed_count: latestRec?.feed_count||null,
    latest_bodies: latestRec?.bodies_fetched||null,
    feeds: feedHealth,
    has_d1: !!env.DB, d1_items: d1Count, has_r2: r2Ok,
    rss_feeds: RSS_FEEDS.map(f=>f.name),
    ai_models: AI_MODELS_PRIMARY,
    endpoints: ["/", "/d/:date", "/rss.xml", "/feed.json", "/api/latest", "/api/d/:date", "/api/search?q=", "/api/timeline", "/api/stats", "/ask?q=", "/card/:date.svg", "/weekly", "/health" ]
  });
}

// ---------- Web UI ----------

async function showIndex(env) {
  const idxRaw = await env.KV.get("digest:index");
  const idx = idxRaw ? JSON.parse(idxRaw) : [];
  const latest = await env.KV.get("digest:latest");
  const weeklyRaw = await env.KV.get("weekly:index");
  const weeklyIdx = weeklyRaw ? JSON.parse(weeklyRaw) : [];
  let latestRec=null;
  if(latest){ const raw=await env.KV.get("digest:"+latest); if(raw) try{ latestRec=JSON.parse(raw);}catch(e){} }

  const items = idx
    .map((d) => {
      const isLatest = d === latest;
      const isEvening = d.endsWith("-evening");
      const label = isEvening ? d.replace("-evening"," · 晚报") : d;
      const badge = isLatest ? '  <span class="badge">最新</span>' : (isEvening ? ' <span class="badge evening">晚报</span>' : "");
      return `<li><a href="/d/${d}">${label}</a>${badge}<a class="mini" href="/api/d/${d}" target="_blank">JSON</a><a class="mini" href="/card/${d}.svg" target="_blank">卡片</a></li>`;
    })
    .join("");

  const weeklyHtml = weeklyIdx.length ? `<div class="weekly-box"><a href="/weekly">📅 本周周报 (${weeklyIdx[0]}) →</a></div>` : "";

  const html = pageShell(
    "时事简报 · 历史归档",
    `<header>
      <h1>📰 时事简报</h1>
      <p class="sub">每日 07:00 早报 · 19:00 晚报（北京时间）自动推送 · 数据源：微博热搜 + BBC / DW / NYT / FT / RFA / RFI / Solidot（7源）· 深度正文 · AI: deepseek-32b ▶ qwq-32b ▶ gpt-oss-20b</p>
      <div class="toolbar">
        <a href="/rss.xml" target="_blank">📡 RSS</a>
        <a href="/feed.json" target="_blank">🗞 JSON Feed</a>
        <a href="/health" target="_blank">💚 健康</a>
        <a href="/api/stats" target="_blank">📊 统计</a>
        <a href="/weekly" >📅 周报</a>
        <a href="/api/latest" target="_blank">🔌 API</a>
      </div>
      <div class="search-box">
        <input id="q" placeholder="搜关键词，如：西藏 / 金价 / 制裁" onkeydown="if(event.key==='Enter') doSearch()" />
        <button onclick="doSearch()">搜索</button>
        <button onclick="doTimeline()">近7天</button>
      </div>
      <div class="search-box">
        <input id="askq" placeholder="追问AI，如：高兟案是什么" onkeydown="if(event.key==='Enter') doAsk()" />
        <button onclick="doAsk()">追问</button>
      </div>
      <div id="searchRes" class="search-res"></div>
      ${latestRec ? `<div class="meta-card">最新 <b>${latest}</b> · ${new Date(latestRec.generated_at).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})} · 耗时 ${(latestRec.duration_ms/1000).toFixed(1)}s · 微博${latestRec.weibo_count} · 外媒${latestRec.feed_count} · 正文${latestRec.bodies_fetched||0} · <a href="/d/${latest}">查看</a> · <a href="/api/d/${latest}" target="_blank">JSON</a> · <a href="/card/${latest}.svg" target="_blank">卡片</a></div>` : ""}
      ${weeklyHtml}
    </header>
    <main>
      ${idx.length === 0
        ? '<div class="empty">还没有简报。今日 7:00 会自动生成第一份。<br/><br/>或者你也可以让助手手动触发一次。</div>'
        : `<ul class="archive">${items}</ul>`}
    </main>
    <script>
      async function doSearch(){
        const q=document.getElementById('q').value.trim();
        if(!q) return;
        const box=document.getElementById('searchRes');
        box.innerHTML='🔍 搜索中…';
        try{
          const r=await fetch('/api/search?q='+encodeURIComponent(q)+'&limit=12');
          const j=await r.json();
          if(!j.results||!j.results.length){ box.innerHTML='<div class="empty">无结果，试试 D1 关键词如：西藏</div>'; return; }
          box.innerHTML='<h3>搜索：'+esc(q)+' ('+j.count+')</h3>' + j.results.map(x=>'<div class="res-item"><a href="/d/'+x.date+'">'+x.date+'</a> · '+esc(x.snippet.slice(0,180))+' <span class="muted">'+(x.generated_at?new Date(x.generated_at).toLocaleDateString():'' )+'</span></div>').join('');
        }catch(e){ box.innerHTML='搜索失败 '+e; }
      }
      async function doTimeline(){
        const box=document.getElementById('searchRes');
        box.innerHTML='⏳ 加载近7天…';
        try{
          const r=await fetch('/api/timeline?days=7');
          const j=await r.json();
          box.innerHTML='<h3>近7天时间线</h3>' + j.items.map(x=>'<div class="res-item"><a href="/d/'+x.date+'">'+x.date+'</a> · '+(x.one_liner?esc(x.one_liner.slice(0,120)):'')+' <span class="muted">'+(x.duration_ms/1000).toFixed(1)+'s</span></div>').join('');
        }catch(e){ box.innerHTML='加载失败 '+e; }
      }
      async function doAsk(){
        const q=document.getElementById('askq').value.trim();
        if(!q) return;
        const box=document.getElementById('searchRes');
        box.innerHTML='🤖 追问中…';
        try{
          const r=await fetch('/ask?q='+encodeURIComponent(q));
          const j=await r.json();
          if(j.answer) box.innerHTML='<div class="digest" style="margin-top:12px"><h3>追问：'+esc(q)+'</h3><p>'+esc(j.answer).replace(/\\n/g,'<br/>')+'</p><p class="muted">基于 '+esc(j.date||'')+'</p></div>';
          else box.innerHTML='无回答: '+JSON.stringify(j);
        }catch(e){ box.innerHTML='追问失败 '+e }
      }
      function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
    </script>`
  );
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function showDigest(env, id) {
  const rawId = id;
  const isEvening = id.endsWith("-evening");
  // allow both YYYY-MM-DD and YYYY-MM-DD-evening
  if (!/^\d{4}-\d{2}-\d{2}(-evening)?$/.test(id)) return new Response("bad id", { status: 400 });
  let raw = await env.KV.get(`digest:${id}`);
  // fallback: if requesting date without suffix but latest is evening, try evening? keep simple
  if (!raw) return new Response("not found", { status: 404 });
  const record = JSON.parse(raw);
  const bodyHtml = mdToHtml(record.summary_md);
  const weiboList = (record.sources.weibo || [])
    .map((w) => `<li><a href="${escHtml(w.url)}" target="_blank">${escHtml(w.word)}</a> ${w.label ? `<span class="tag">${escHtml(w.label)}</span>` : ""}</li>`)
    .join("");
  const feedsHtml = (record.sources.feeds || [])
    .map((f) => {
      const lis = (f.items || [])
        .map((it) => `<li><a href="${escHtml(it.link)}" target="_blank">${escHtml(it.title)}</a></li>`)
        .join("");
      return `<details class="feed"><summary>${escHtml(f.name)} (${f.items?.length || 0})${f.error ? " · 抓取失败" : ""}</summary><ul>${lis}</ul></details>`;
    })
    .join("");

  const editionTag = record.edition === "evening" ? "晚报" : "早报";
  const jsonUrl = `/api/d/${record.id}`;
  const cardUrl = `/card/${record.id}.svg`;

  const html = pageShell(
    `${record.id} · 时事简报`,
    `<header>
      <a href="/" class="back">← 归档</a>
      <p class="meta">${record.id} · ${editionTag} · 生成于 ${new Date(record.generated_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} · 耗时 ${(record.duration_ms / 1000).toFixed(1)}s · 微博${record.weibo_count} · 外媒${record.feed_count} · 正文${record.bodies_fetched||0} · 评分${record.scored_count||0}</p>
      <div class="toolbar">
        <button onclick="copyMD()">📋 复制Markdown</button>
        <a href="${jsonUrl}" target="_blank">🔌 JSON</a>
        <a href="${cardUrl}" target="_blank">🖼 卡片</a>
        <a href="/rss.xml" target="_blank">📡 RSS</a>
        <a href="/health" target="_blank">💚 健康</a>
      </div>
    </header>
    <main>
      <article class="digest" id="digest">${bodyHtml}</article>
      <div class="ask-box">
        <input id="askq" placeholder="就本期追问，如：西藏堰塞湖有多严重？" onkeydown="if(event.key==='Enter') doAsk()" />
        <button onclick="doAsk()">追问AI</button>
        <span class="muted">基于本期7源正文回答</span>
        <div id="askRes"></div>
      </div>
      <details class="sources">
        <summary>📦 数据源明细</summary>
        <h3>微博热搜</h3>
        <ol class="weibo">${weiboList}</ol>
        <h3>外媒</h3>
        ${feedsHtml}
      </details>
    </main>
    <script>
      const md = ${JSON.stringify(record.summary_md)};
      function copyMD(){ navigator.clipboard.writeText(md).then(()=>alert('已复制'),()=>prompt('复制',md)); }
      async function doAsk(){
        const q=document.getElementById('askq').value.trim();
        if(!q) return;
        const box=document.getElementById('askRes');
        box.innerHTML='🤖 追问中…';
        try{
          const r=await fetch('/ask?q='+encodeURIComponent(q)+'&date='+encodeURIComponent('${record.id.replace(/'/g,"\'")}'));
          const j=await r.json();
          if(j.answer) box.innerHTML='<div class="digest" style="margin-top:12px"><p>'+j.answer.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\n/g,"<br/>")+'</p></div>';
          else box.innerHTML='无回答 '+JSON.stringify(j);
        }catch(e){ box.innerHTML='失败 '+e; }
      }
    </script>`
  );
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function pageShell(title, inner) {
  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(title)}</title>
<style>
  :root { --bg: #faf8f3; --fg: #1a1a1a; --muted: #6b6b6b; --accent: #c0392b; --card: #fff; --border: #e8e3d8; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #15161a; --fg: #ebe8e0; --muted: #9c958b; --accent: #e74c3c; --card: #1e1f24; --border: #2a2b30; }
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--bg); color: var(--fg); margin: 0; line-height: 1.7; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 24px 18px 80px; }
  header { padding: 12px 0 18px; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
  header h1 { margin: 0 0 6px; font-size: 26px; }
  header .sub, header .meta { color: var(--muted); font-size: 13px; margin: 0; }
  .back { color: var(--accent); text-decoration: none; font-size: 14px; }
  .back:hover { text-decoration: underline; }
  .toolbar { margin: 12px 0 0; display:flex; flex-wrap:wrap; gap:8px; }
  .toolbar a, .toolbar button { font-size:13px; padding:6px 10px; border:1px solid var(--border); background:var(--card); color:var(--fg); border-radius:999px; text-decoration:none; cursor:pointer; }
  .toolbar a:hover, .toolbar button:hover { border-color: var(--accent); color:var(--accent); }
  .search-box { margin:14px 0 0; display:flex; gap:8px; }
  .search-box input { flex:1; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--card); color:var(--fg); }
  .search-box button { padding:10px 14px; background:var(--accent); color:#fff; border:0; border-radius:10px; cursor:pointer; }
  .search-res { margin-top:14px; }
  .search-res h3 { font-size:14px; color:var(--muted); margin:10px 0 8px; }
  .res-item { padding:10px 12px; background:var(--card); border:1px solid var(--border); border-radius:10px; margin-bottom:8px; font-size:14px; }
  .meta-card { margin-top:14px; padding:12px 14px; background:var(--card); border:1px solid var(--border); border-radius:10px; font-size:13px; color:var(--muted); }
  .weekly-box { margin-top:12px; padding:10px 14px; background:var(--card); border:1px dashed var(--accent); border-radius:10px; font-size:14px; }
  ul.archive { list-style: none; padding: 0; margin: 0; }
  ul.archive li { padding: 14px 16px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  ul.archive a { color: var(--fg); text-decoration: none; font-size: 16px; font-weight: 500; }
  ul.archive a.mini { font-size:12px; font-weight:400; color:var(--muted); border:1px solid var(--border); padding:2px 6px; border-radius:999px; }
  .badge { background: var(--accent); color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 99px; margin-left: 6px; vertical-align: middle; }
  .badge.evening { background:#2c3e50; }
  .empty { padding: 40px 20px; text-align: center; color: var(--muted); background: var(--card); border: 1px solid var(--border); border-radius: 10px; }
  article.digest { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px 26px; }
  article.digest h1 { font-size: 22px; margin: 0 0 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  article.digest h2 { font-size: 17px; margin: 26px 0 12px; }
  article.digest h3 { font-size: 15px; margin: 20px 0 10px; color: var(--muted); }
  article.digest p { margin: 8px 0; }
  article.digest ul, article.digest ol { padding-left: 24px; margin: 8px 0; }
  article.digest li { margin: 4px 0; }
  article.digest a { color: var(--accent); }
  details.sources { margin-top: 28px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; }
  details.sources summary { cursor: pointer; font-weight: 500; }
  details.sources h3 { font-size: 14px; color: var(--muted); margin: 18px 0 8px; }
  details.feed { margin: 8px 0; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; }
  details.feed summary { cursor: pointer; font-size: 14px; }
  details.feed ul, ol.weibo { padding-left: 22px; }
  details.feed li, ol.weibo li { margin: 4px 0; font-size: 14px; }
  .tag { color: var(--accent); font-size: 11px; margin-left: 4px; }
  .ask-box { margin-top:18px; padding:14px; background:var(--card); border:1px solid var(--border); border-radius:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .ask-box input { flex:1; min-width:180px; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--bg); color:var(--fg); }
  .ask-box button { padding:10px 14px; background:var(--accent); color:#fff; border:0; border-radius:10px; cursor:pointer; }
  .ask-box .muted { font-size:12px; color:var(--muted); }
  #askRes { width:100%; }
  a { color: var(--accent); }
  footer { margin-top:40px; padding-top:16px; border-top:1px solid var(--border); font-size:12px; color:var(--muted); text-align:center; }
  footer a { color:var(--muted); text-decoration:underline; }
</style>
</head>
<body><div class="wrap">${inner}<footer>📡 <a href="/rss.xml">RSS</a> · <a href="/feed.json">JSON Feed</a> · <a href="/api/search?q=%E8%A5%BF%E8%97%8F">搜索</a> · <a href="/api/timeline?days=7">时间线</a> · <a href="/health">健康</a> · <a href="/weekly">周报</a> · <a href="https://news.leilaomi.cc.cd" target="_blank">news.leilaomi.cc.cd</a></footer></div></body>
</html>`;
}function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Minimal markdown → html
function mdToHtml(md) {
  if (!md) return "";
  const lines = md.split(/\r?\n/);
  const out = [];
  let inList = null; // "ul" | "ol" | null
  const flushList = () => { if (inList) { out.push(`</${inList}>`); inList = null; } };
  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushList();
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      continue;
    }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      if (inList !== "ul") { flushList(); out.push("<ul>"); inList = "ul"; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    if ((m = line.match(/^\s*(\d+)\.\s+(.*)$/))) {
      if (inList !== "ol") { flushList(); out.push("<ol>"); inList = "ol"; }
      out.push(`<li>${inline(m[2])}</li>`);
      continue;
    }
    if (/^---+$/.test(line)) { flushList(); out.push("<hr/>"); continue; }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return out.join("\n");
}
function inline(s) {
  let x = escHtml(s);
  x = x.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  x = x.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  x = x.replace(/`([^`]+)`/g, "<code>$1</code>");
  return x;
}

// ---------- Utils ----------

function todayShanghai() {
  // Format YYYY-MM-DD in Asia/Shanghai
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA gives YYYY-MM-DD
}
