# Fantasy Map Generator

A web-based tool for creating procedurally generated fantasy maps with customizable features. Perfect for worldbuilding, tabletop RPGs, and creative writing projects.

![Fantasy Map Example](screenshot.png)

## Features

- **Procedural Generation**: Creates unique landmasses, mountains, forests, rivers, and cities
- **Customizable Settings**: Adjust ocean level, mountain density, forest coverage, and more
- **City Networks**: Generates cities with unique names and connecting road networks
- **Multiple Styles**: Choose between color or parchment map styles
- **Dark Mode Support**: Comfortable viewing in any lighting condition
- **Responsive Design**: Works on desktop and mobile devices
- **Seed-Based Generation**: Every map can be recreated using the same seed

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/fantasy-map-generator.git
   cd fantasy-map-generator
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and visit:
   ```
   http://localhost:5173/
   ```

## Usage

- **Generate New Map**: Click the "Regenerate" button to create a new random map
- **Adjust Features**: Use the sliders to customize terrain features
- **Change Style**: Toggle between color and parchment styles
- **Download Map**: Save your creation as a PNG image

## How It Works

The generator uses seeded Perlin noise to create consistent, reproducible terrain. Different noise functions with varying parameters create the landmasses, mountain ridges, forest clusters, and other features. Each feature is rendered in layers to build up the complete map.

## Technologies Used

- React
- Tailwind CSS
- HTML Canvas API
- Vite

## Contributing

Contributions are welcome! If you'd like to improve the generator or add new features, please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by various procedural generation techniques and fantasy cartography
- Icons provided by Lucide React 