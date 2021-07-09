const path = require('path');

module.exports = {
    entry: './index.ts',
    mode: 'production',
    target: 'node',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.json'],
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget : 'commonjs2'
    },
    performance: {
        maxEntrypointSize: 5120000,
        maxAssetSize: 5120000
    }
};
