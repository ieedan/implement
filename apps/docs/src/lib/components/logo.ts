import { Svg, type Mountable, type SvgProps } from "@implementjs/core";

// the favicon mark (`static/favicon.svg`) without its tile, recolored to
// `currentColor` so it takes the surrounding text color. The glyph is taller
// than it is wide, so size it by height (`h-4 w-auto`) rather than `size-*`.
const LOGO_SOURCE = `<svg viewBox="0 0 245 421" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M159.545 170.58C158.524 174.391 161.395 178.133 165.34 178.133H238.181C243.26 178.133 246.042 184.05 242.801 187.961L52.237 417.945C52.0355 418.188 51.8255 418.41 51.6081 418.61C51.4631 418.744 51.3147 418.868 51.1637 418.983C50.1824 419.732 49.084 420.098 47.9909 420.151C47.8226 420.159 47.6545 420.16 47.487 420.153C43.8022 420.012 40.391 416.408 41.9821 412.057L100.038 253.284C101.41 249.531 98.8067 245.596 94.9665 245.248C94.7106 245.225 94.4493 245.218 94.1832 245.227L6.23305 248.452C6.0722 248.458 5.91298 248.458 5.75649 248.452C1.06198 248.276 -1.61394 242.921 1.06411 239.061C1.15328 238.933 1.2481 238.806 1.34926 238.681L32.6168 200.058L168.64 136.629L159.545 170.58ZM192.755 2.2558C196.831 -2.77933 204.89 1.3261 203.214 7.58393L183.915 79.6142L97.5045 119.908L192.755 2.2558Z"/></svg>`;

/** The implement bolt, for the site header and the home hero. */
export function Logo(props: SvgProps = {}): Mountable {
	return Svg(LOGO_SOURCE, props);
}
