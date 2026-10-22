// Pasting a photo into Decap's story box otherwise inserts the whole file as a
// data URL. A phone photo is large enough to freeze the editor. This catches
// that paste, shrinks the photo, and stores it as a file under site/img/blog.
(function () {
  var previousCompose = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = function () {
    var args = arguments;
    var composed;
    if (typeof previousCompose === "function") {
      composed = previousCompose.apply(this, args);
    } else if (args.length === 1 && typeof args[0] === "function") {
      composed = args[0];
    } else {
      composed = function (createStore) {
        return createStore;
      };
    }
    return function (createStore) {
      var next = composed(createStore);
      return function (reducer, preloadedState) {
        var store = next(reducer, preloadedState);
        window.__JAKE_CMS_STORE__ = store;
        return store;
      };
    };
  };

  var REPO = "bstyx/Jake-lipohar-site";
  var BRANCH = "main";
  var MEDIA_FOLDER = "site/img/blog";
  var PUBLIC_FOLDER = "/img/blog";
  var MAX_EDGE = 2000;
  var JPEG_QUALITY = 0.8;
  var previews = new Map();
  var chain = Promise.resolve();

  function toast(message) {
    var el = document.getElementById("paste-photo-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "paste-photo-toast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;z-index:100000;left:16px;right:16px;bottom:16px;max-width:28rem;margin:0 auto;background:#06202f;color:#fff;padding:14px 16px;border-radius:14px;font:600 15px/1.4 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35)";
      document.body.appendChild(el);
    }
    el.textContent = message;
  }

  function filesFrom(event) {
    var data = event.clipboardData;
    if (!data) return [];
    var found = [];
    var i;
    if (data.files) {
      for (i = 0; i < data.files.length; i += 1) {
        if (data.files[i].type.indexOf("image/") === 0) found.push(data.files[i]);
      }
    }
    if (!found.length && data.items) {
      for (i = 0; i < data.items.length; i += 1) {
        var item = data.items[i];
        if (item.kind === "file" && item.type.indexOf("image/") === 0) {
          var file = item.getAsFile();
          if (file) found.push(file);
        }
      }
    }
    if (!found.length) {
      var html = read(data, "text/html");
      var text = read(data, "text/plain");
      var match = html.match(/src\s*=\s*["'](data:image\/(?:png|jpe?g|gif|webp);base64,[^"']+)["']/i);
      if (!match && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(text.trim())) match = [text.trim(), text.trim()];
      if (match) {
        var parsed = dataUriToFile(match[1]);
        if (parsed) found.push(parsed);
      }
    }
    return found;
  }

  function read(data, type) {
    try {
      return data.getData(type) || "";
    } catch (error) {
      return "";
    }
  }

  function shouldTakeOver(event, files) {
    if (!files.length) return false;
    var data = event.clipboardData;
    var html = data ? read(data, "text/html") : "";
    var text = data ? read(data, "text/plain") : "";
    if (/data:image\//i.test(html) || /^data:image\//i.test(text.trim())) return true;
    var plain = text.replace(/\s+/g, " ").trim();
    var htmlText = html.replace(/<img\b[^>]*>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (plain.length > 40 || htmlText.length > 40) return false;
    var target = event.target;
    if (target && target.closest && target.closest("input, textarea")) return false;
    return true;
  }

  function dataUriToFile(uri) {
    var match = String(uri).match(/^data:(image\/(?:png|jpe?g|gif|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return null;
    var binary = atob(match[2].replace(/\s/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    var type = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
    return new File([bytes], fileName(type === "image/png" ? "png" : "jpg"), { type: type });
  }

  function fileName(ext) {
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + "-" + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds());
    return "paste-" + stamp + "-" + Math.random().toString(16).slice(2, 6) + "." + ext;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("That photo could not be read. Try the image button and choose a JPEG."));
      };
      image.src = url;
    });
  }

  function shrink(file) {
    if (file.type === "image/svg+xml") {
      return Promise.reject(new Error("Paste a photo. SVG drawings are not used."));
    }
    return loadImage(file).then(function (image) {
      var scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      var width = Math.max(1, Math.round(image.width * scale));
      var height = Math.max(1, Math.round(image.height * scale));
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      var keepPng = false;
      if (file.type === "image/png") {
        var sample = context.getImageData(0, 0, Math.min(width, 48), Math.min(height, 48)).data;
        for (var i = 3; i < sample.length; i += 4) {
          if (sample[i] < 250) {
            keepPng = true;
            break;
          }
        }
      }
      var type = keepPng ? "image/png" : "image/jpeg";
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error("Could not shrink that photo."));
            return;
          }
          var name = fileName(keepPng ? "png" : "jpg");
          resolve(new File([blob], name, { type: type }));
        }, type, JPEG_QUALITY);
      });
    });
  }

  function fiberOf(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (el) {
      var keys = Object.keys(el);
      for (var i = 0; i < keys.length; i += 1) {
        if (keys[i].indexOf("__reactFiber$") === 0 || keys[i].indexOf("__reactInternalInstance$") === 0) return el[keys[i]];
      }
      el = el.parentElement;
    }
    return null;
  }

  function editorFrom(node) {
    var fiber = fiberOf(node);
    for (var guard = 0; fiber && guard < 50; guard += 1) {
      var props = fiber.memoizedProps;
      if (props && props.editor && typeof props.editor.insertText === "function") return props.editor;
      fiber = fiber.return;
    }
    return null;
  }

  function library() {
    var root = document.getElementById("nc-root") || document.body;
    var keys = Object.keys(root);
    var fiber = null;
    for (var i = 0; i < keys.length; i += 1) {
      if (keys[i].indexOf("__reactContainer") === 0 || keys[i].indexOf("__reactFiber") === 0) {
        fiber = root[keys[i]];
        break;
      }
    }
    if (fiber && fiber.current) fiber = fiber.current;
    var stack = fiber ? [fiber] : [];
    var seen = 0;
    while (stack.length && seen < 20000) {
      var current = stack.pop();
      seen += 1;
      if (!current) continue;
      if (current.stateNode && typeof current.stateNode.handlePersist === "function") return current.stateNode;
      if (current.child) stack.push(current.child);
      if (current.sibling) stack.push(current.sibling);
    }
    return null;
  }

  function draftCount() {
    var store = window.__JAKE_CMS_STORE__;
    if (!store) return -1;
    try {
      var files = store.getState().entryDraft.getIn(["entry", "mediaFiles"]);
      return files && typeof files.size === "number" ? files.size : 0;
    } catch (error) {
      return -1;
    }
  }

  function newestPublicPath(before) {
    var store = window.__JAKE_CMS_STORE__;
    if (!store || before < 0) return "";
    try {
      var files = store.getState().entryDraft.getIn(["entry", "mediaFiles"]);
      if (!files || files.size <= before) return "";
      var added = files.get(files.size - 1);
      var repoPath = String(added.get("path") || added.get("name") || "");
      var base = repoPath.split("/").pop();
      return base ? PUBLIC_FOLDER + "/" + base : "";
    } catch (error) {
      return "";
    }
  }

  function entryIsOpen() {
    var store = window.__JAKE_CMS_STORE__;
    if (!store) return false;
    try {
      var entry = store.getState().entryDraft.get("entry");
      return !!(entry && entry.size);
    } catch (error) {
      return false;
    }
  }

  function uploadWithDecap(file) {
    var instance = library();
    if (!instance) return Promise.resolve("");
    if (!instance.scrollContainerRef) instance.scrollContainerRef = { scrollTop: 0 };
    var before = draftCount();
    return Promise.resolve(instance.handlePersist({
      persist: function () {},
      stopPropagation: function () {},
      preventDefault: function () {},
      target: { files: [file], value: "" },
    })).then(function () {
      return newestPublicPath(before);
    }).catch(function (error) {
      if (error && /scroll/i.test(String(error.message || error))) return newestPublicPath(before);
      return "";
    });
  }

  function githubToken() {
    try {
      var saved = JSON.parse(localStorage.getItem("decap-cms-user") || "null");
      return saved && saved.token ? saved.token : "";
    } catch (error) {
      return "";
    }
  }

  function github(token, apiPath, options) {
    return fetch("https://api.github.com" + apiPath, {
      method: options && options.method || "GET",
      headers: {
        Authorization: "token " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: options && options.body,
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.message || "GitHub could not save the photo.");
        return body;
      });
    });
  }

  function uploadToGitHub(file) {
    var token = githubToken();
    if (!token) return Promise.reject(new Error("Log in with GitHub, open the post, and paste the photo again."));
    return file.arrayBuffer().then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      var binary = "";
      for (var i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      }
      var content = btoa(binary);
      var repoPath = MEDIA_FOLDER + "/" + file.name;
      function once() {
        return github(token, "/repos/" + REPO + "/git/ref/heads/" + BRANCH).then(function (ref) {
          var commitSha = ref.object.sha;
          return github(token, "/repos/" + REPO + "/git/commits/" + commitSha).then(function (commit) {
            return github(token, "/repos/" + REPO + "/git/blobs", {
              method: "POST",
              body: JSON.stringify({ content: content, encoding: "base64" }),
            }).then(function (blob) {
              return github(token, "/repos/" + REPO + "/git/trees", {
                method: "POST",
                body: JSON.stringify({
                  base_tree: commit.tree.sha,
                  tree: [{ path: repoPath, mode: "100644", type: "blob", sha: blob.sha }],
                }),
              });
            }).then(function (tree) {
              return github(token, "/repos/" + REPO + "/git/commits", {
                method: "POST",
                body: JSON.stringify({
                  message: 'Add photo "' + repoPath + '"',
                  tree: tree.sha,
                  parents: [commitSha],
                }),
              });
            }).then(function (commit) {
              return github(token, "/repos/" + REPO + "/git/refs/heads/" + BRANCH, {
                method: "PATCH",
                body: JSON.stringify({ sha: commit.sha }),
              });
            });
          });
        });
      }
      return once().catch(function () { return once(); }).then(function () {
        return PUBLIC_FOLDER + "/" + file.name;
      });
    });
  }

  function selectEnd(editor) {
    if (editor.selection || !editor.children || !editor.children.length) return;
    var last = editor.children.length - 1;
    var block = editor.children[last];
    var text = block && block.children && block.children[0] ? String(block.children[0].text || "") : "";
    editor.selection = {
      anchor: { path: [last, 0], offset: text.length },
      focus: { path: [last, 0], offset: text.length },
    };
  }

  function insertIntoStory(target, url) {
    var slate = document.querySelector("[data-slate-editor='true']");
    var editor = editorFrom(target) || editorFrom(slate);
    if (!editor) throw new Error("Click in the story, then paste the photo again.");
    selectEnd(editor);
    var node = { type: "image", data: { url: url, alt: "", title: "" }, children: [{ text: "" }] };
    var markdown = "\n![photo](" + url + ")\n";
    if (editor.isVoid && editor.isVoid({ type: "image" }) && typeof editor.insertNode === "function") {
      try {
        editor.insertNode(node);
        return;
      } catch (error) {
        editor.insertText(markdown);
        return;
      }
    }
    editor.insertText(markdown);
  }

  function rememberPreview(url, file) {
    var blobUrl = URL.createObjectURL(file);
    previews.set(url, blobUrl);
    previews.set(new URL(url, window.location.origin).href, blobUrl);
  }

  function addOne(file, target) {
    return shrink(file).then(function (small) {
      return uploadWithDecap(small).then(function (url) {
        if (url) return { url: url, file: small };
        return uploadToGitHub(small).then(function (uploaded) {
          return { url: uploaded, file: small };
        });
      });
    }).then(function (saved) {
      rememberPreview(saved.url, saved.file);
      insertIntoStory(target, saved.url);
    });
  }

  function onPaste(event) {
    var files = filesFrom(event);
    if (!shouldTakeOver(event, files)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    var target = event.target;
    if (!entryIsOpen() && !editorFrom(target)) {
      toast("Open a post, click in the story, then paste the photo.");
      return;
    }
    toast(files.length > 1 ? "Adding your photos…" : "Adding your photo…");
    chain = chain.then(function () {
      var sequence = Promise.resolve();
      files.forEach(function (file) {
        sequence = sequence.then(function () { return addOne(file, target); });
      });
      return sequence;
    }).then(function () {
      toast("Photo added. It is saved as a file. Press Publish to put it on the site.");
    }).catch(function (error) {
      toast(error && error.message ? error.message : "The photo could not be added. Try the image button.");
    });
  }

  document.addEventListener("paste", onPaste, true);
  document.addEventListener("error", function (event) {
    var image = event.target;
    if (!image || image.tagName !== "IMG") return;
    var blobUrl = previews.get(image.getAttribute("src")) || previews.get(image.src);
    if (blobUrl && image.src !== blobUrl) image.src = blobUrl;
  }, true);

  function guardData(payload) {
    var entry = payload && payload.entry;
    var data = entry && entry.get && entry.get("data");
    if (!data || !data.get) return;
    ["body", "cover"].forEach(function (key) {
      if (/data:image\//i.test(String(data.get(key) || ""))) {
        throw new Error("This post still has a photo pasted as raw data. Delete it and paste the photo again so it is saved as a file.");
      }
    });
  }

  function watchCms() {
    if (window.CMS && typeof window.CMS.registerEventListener === "function") {
      window.CMS.registerEventListener({ name: "preSave", handler: guardData });
      window.CMS.registerEventListener({ name: "prePublish", handler: guardData });
      return;
    }
    window.setTimeout(watchCms, 50);
  }
  watchCms();

  window.__jakePastePhoto = { shrink: shrink, shouldTakeOver: shouldTakeOver, filesFrom: filesFrom };
})();
