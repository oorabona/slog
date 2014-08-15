Package.describe({
	summary: "Slog! A simple logger"
});

Package.on_use(function(api) {
	api.use(['underscore']);

	// Exports
	if( api.export ) {
		api.export(["SLog"], ["client", "server"]);
	}

	api.add_files([
		"lib/slog.js"
	], ["client","server"]);

});
