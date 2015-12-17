GollumJS.NS(Server.Plugin, function() {

	var FS              = require('fs-promise');
	var Promise         = require('rsvp').Promise;
	var Collection      = GollumJS.Utils.Collection;
	var ReflectionClass = GollumJS.Reflection.ReflectionClass;

	this.Loader = new GollumJS.Class({
		
		Static: {
			PLUGIN_DIR: 'plugins',

			PLUGIN_FILE_DESCRIPTOR: 'plugin.json',
			PLUGIN_FILE_INCLUDE   : 'include.json'
		},

		loader: null,

		initialize: function (loader) {
			this.loader = loader;
		},

		loadAll: function () {
			return this._search()
				.then(this._load.bind(this))
				.then(this._createPluginObject.bind(this))
			;
		},

		_search: function () {
			var _this = this;
			return new Promise(function(resolve, reject) {

				var plugins     = [];
				var pluginsPath = _this.loader.server.getRootPath()+'/'+_this.self.PLUGIN_DIR;

				FS.readdir(pluginsPath)
					.then(function (files) {
						Collection.eachStep(files, function (i, file, step) {
							var pluginPath = pluginsPath+'/'+file;
							FS.stat(pluginPath)
								.then(function (stats) {
									if (stats.isDirectory()) {
										Server.Plugin.DirectoryContainer.isPlugin(pluginPath)
											.then(function(isPlugin) {
												if (isPlugin) {
													plugins.push(new Server.Plugin.DirectoryContainer(pluginPath));
												};
												step();
											});
										;
									} else {
										// TODO ZipContainer not implemented
										step();
									}
								})
								.catch(function () {
									console.error
									step();
								})
							;
						},
						function () {
							resolve(plugins);
						});
					})
					.catch(function (err) {
						console.error (err);
						reject(err);
					})
				;
			});
		},

		_load: function (pluginContainers) {

			var _this = this;

			return new Promise(function(resolve, reject) {

				Collection.eachStep(pluginContainers, function (i, container, step) {
					try {
						_this._loadMetaInfosFile (container)
							.then(function ()      { return container.getInclude();                       })
							.then(function (files) { return _this._requireJsFile     (container, files);  })
							.then(step)
							.catch (function (e) {
								throw e;
							})
						;
					} catch (e) {
						console.log (e);
						step();
					}
				},
				function () {
					resolve(pluginContainers);
				});
			});
		},

		_loadMetaInfosFile: function (container) {
			var _this = this;
			return container.getRunPath()
				.then(function (runPath) {
					return FS.readFile(runPath+'/'+_this.self.PLUGIN_FILE_DESCRIPTOR, "utf8").
						then(JSON.parse)
					;
				})
				.then(function (json) {
					container.metaInfos = json;
					console.log ("SMC Loader: load meta infos for \"" + container.metaInfos.name + "\"");
					return Server.Utils.Promise.resolve(container.metaInfos);
				})
			;
		},

		_requireJsFile: function (container, files) {
			return container.getRunPath().
				then(function(runPath) {
					return new Promise(function(resolve, reject) {
						
						Collection.eachStep(files, function (i, file, step) {
							try {
								var jsFilePath = runPath+"/"+file;
								console.info ("SMC Loader: load JS file:", jsFilePath);
								require(jsFilePath);
								step();
							} catch (e) {
								console.log (e);
								step();
							}
						},
						function () {
							console.log ("SMC Loader: JS files are loaded");
							resolve();
						});
					});
				})
			;
		},

		
		_createPluginObject: function (pluginContainers) {
			
			var _this = this;
			var plugin = [];

			return new Promise(function(resolve, reject) {
				Collection.eachStep(pluginContainers, function (i, container, step) {
					try {
						var clazz = ReflectionClass.getClassByName(container.metaInfos.main);
						if (clazz) {
							plugin.push(new clazz(container));
						} else {
							console.error("SMC Loader: Can't create plugin instance "+container.metaInfos.name);
							console.error("  can't create \""+container.metaInfos.main+"\" instance.");
						}
						step();
					} catch (e) {
						console.error("SMC Loader: Can't create plugin instance "+container.metaInfos.name);
						console.log (e);
						step();
					}
				},
				function() {
					resolve(plugin);
				});
			});

			return Server.Utils.Promise.resolve(plugin);
		}
		
		
	});
});