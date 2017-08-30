const http = require("http"),
	url = require("url"),
	path = require("path"),
	fs = require("fs");
	querystring = require("querystring"),
	util = require("util");

const mimetype = {
	"html" : "text/html",
	"css"  : "text/css",
	"js"   : "text/javascript",
	"json" : "application/json",
	"ico"  : "image/x-icon",
	"gif"  : "image/gif",
	"jpeg" : "image/jpeg",
	"jpg"  : "image/jpeg",
	"png"  : "image/png",
	"pdf"  : "application/pdf",
	"svg"  : "image/svg+xml",
	"swf"  : "application/x-shockwave-flash",
	"tiff" : "image/tiff",
	"txt"  : "text/plain",
	"wav"  : "audio/x-wav",
	"wma"  : "audio/x-ms-wma",
	"wmv"  : "video/x-ms-wmv",
	"xml"  : "text/xml"
};

function router(req, res) {
	var headers = req.headers, hasContentType = headers['content-type'], contentLength = req.headers['content-length'];
	var typeSets, isUpload = false, hasBoundary, boundary;
	if (hasContentType) {
		typeSets = headers['content-type'].split(";");
	}
	if (req.url == "/upload" && req.method.toLowerCase() == "post") {
		if (typeSets && typeSets[0] == "multipart/form-data") {
			isUpload = true;
			hasBoundary = typeSets[1].match(/(boundary)=([a-z0-9-]+)/i);
			boundary = hasBoundary ? hasBoundary[2] : null;
		}
		// 获取请求数据
		var chunks = "", bufferArray = [], bufferSize = 0;
		req.on("data", function(chunk) {
			chunks += chunk;
			bufferArray.push(chunk);
			bufferSize += chunk.length;
		});
		req.on("end", function(data) {
			var buffer = Buffer.concat(bufferArray, bufferSize);
			// console.log(util.inspect(querystring.parse(chunks)));// 普通的POST参数
			// fs.writeFileSync("./args.txt", buffer.toString());
			// 记录所有换行符;网络协议中一般都以连续的CR、LF(即\r、\n或0x0D、Ox0A)
			var newArray = [0];
			for (var i = 0; i < buffer.length; i++) {
				if (buffer[i].toString() == 13 && buffer[i+1].toString() == 10) {
					newArray.push(i);
				}
			}
			var fields = [],                // 存放普通form控件参数，input[type=file]以外的控件
				files = [],                 // 存放input[type=file]提交的文件
				starting = false,           // 是否为一个参数的开始
				contentStart = false,       // 是否开始为内容，防止二进制内容中有空行，如: 上传的文本文件内容存在空行
				offseted = false,           // 记录第一次读取内容的读取(因记录的换行符位置而变)
				newField = {isFile: false}; // 临时存放提交的参数
			// 根据分界符将所有数据取出
			for (var x = 0; x < newArray.length; x++) {
				if (newArray[x+1]) {
					var chunk = buffer.slice(newArray[x], newArray[x+1]).toString();
					if (isBoundary(chunk, boundary)) {
						starting = !starting;
						if (starting) {
							newField = {isFile: false};
						} else {
							if (newField.isFile) {
								newField.filename && files.push(newField);
							} else {
								fields.push(newField);
							}
							contentStart = false;
							// 结束即是开始
							starting = true;
							newField = {isFile: false};
							// console.log("Strat: ", x);
						}
					} else if (isEmptyLine(chunk)) {
						if (!contentStart) {
							contentStart = true;
							continue;
						} else {
							newField.isFile && newField.filename && newField.data.push(buffer.slice(newArray[x], newArray[x+1]));
						}
					} else if (isFieldName(chunk)) {
						newField.name = chunk.match(/name="(\w+)"/)[1];
						if (chunk.indexOf("filename") != -1) {
							newField.isFile = true;
							var filename = chunk.match(/filename="(.+)"/);
							newField.filename = filename ? filename[1] : "";
						} else {
							newField.isFile = false;
						}
					} else if (isFileType(chunk)) {
						newField.type = chunk.match(/(\w+\/\w+)/)[1];
					} else {
						if (newField.isFile) {
							newField.data = newField.data || [];
							if (offseted) {
								newField.data.push(buffer.slice(newArray[x], newArray[x+1]));
							} else {
								newField.data.push(buffer.slice(newArray[x]+2, newArray[x+1]));
								offseted = true;
							}
						} else {
							newField.value = chunk.replace(/^\r\n|\r\n$/, "");
						}
					}
					// console.log(chunk.replace(/\r\n/g, "\\r\\n"));// 将换行符替换成可显示的字符串
				}
			}
			//
			if (files.length) {
				for (var y = 0; y < files.length; y++) {
					files[y].data = Buffer.concat(files[y].data);
					fs.writeFileSync("./uploads/" + files[y].filename, files[y].data);
				}
			}
			//
			res.writeHead(200, {'content-type': 'application/json'});
			res.write(JSON.stringify({
				fields: (function() {
					var ret = {};
					fields.forEach(function(item) {
						ret[item.name] = item.value;
					});
					return ret;
				})(),
				files: files.map(function(item) {
					return {
						name: item.name,
						filename: item.filename,
						type: item.type,
						path: "/uploads/" + item.filename
					}
				})
			}));
			res.end();
		});
		req.on("error", function(error) {
			console.log("Err:: ", error);
		})
	} else if (req.url.indexOf("uploads") != -1) {
		var pathname = url.parse(req.url).pathname;
		var extname = path.extname( pathname );
		var type = mimetype[extname.substr(1)];
		var filePath = path.join(__dirname, pathname);
		fs.exists(filePath, function(exists){
			if (exists) {
				fs.readFile(filePath, "binary", function(error, file) {
					if (error) {
						res.writeHead(500, {"Content-Type": "text/plain"});
						res.write(error + "\n");
						res.end();
					} else {
						res.writeHead(200, type);
						res.write(file, "binary");
						res.end();
					}
				});
			} else {
				res.writeHead(404, {"Content-Type": "text/plain"});
				res.write("File Not Found");
				res.end();
			}
		});
	} else {
		fs.readFile("index.html", "binary", function(error, file) {
			if (error) {
				res.writeHead(500, {"Content-Type": "text/plain"});
				res.write(error + "\n");
				res.end();
			} else {
				res.writeHead(200, {'content-type': 'text/html'});
				res.write(file, "binary");
				res.end();
			}
		});
	}
}
// 判断是否是边界分隔符
function isBoundary(chunk, boundary) {
	return chunk.replace(/-|\r\n|\\r\\n/g, "") == boundary.replace(/-|\r\n|\\r\\n/g, "");
}
// 判断是否是空行
function isEmptyLine(chunk) {
	return chunk.replace(/\r\n|\\r\\n/g, "") === "";
}
// 判断是否是字段名
function isFieldName(chunk) {
	return /Content-Disposition/.test(chunk);
}
// 判断是否是文件类型说明
function isFileType(chunk) {
	return /Content-Type/.test(chunk);
}

const server = http.createServer(router);

server.listen(8080);

/*
POST 提交的数据格式如下:
  每行数据结尾都有\r\n换行(便于观察在下面假数据中每行都加上了\r\n)
  记录所有换行的位置即可得到一行数据，再处理每一行数据即可
  “-----------------------------135152451731465”为边界分隔符，由浏览器生成，可通过请求头的Content-Type获取到
  每一个参数的数据都在两个边界分隔符中间，包含参数名(name)、参数值、文件名(filename)等属性


-----------------------------135152451731465\r\n
Content-Disposition: form-data; name="text"\r\n
\r\n
hello world!\r\n
-----------------------------135152451731465\r\n
Content-Disposition: form-data; name="image"; filename="test.gif"\r\n
Content-Type: application/octet-stream\r\n
\r\n
(二进制数据)\r\n
-----------------------------135152451731465\r\n
Content-Disposition: form-data; name="text"; filename="test.txt"\r\n
Content-Type: text/plain\r\n
\r\n
Hello World\r\n
\r\n
Test Content\r\n
-----------------------------135152451731465--
*/