/**
 * Plantillas pre-built para crear menús rápidamente desde el builder.
 */

import type { MenuItem, MenuLocation } from "./types";

export interface MenuTemplate {
  id: string;
  name: string;
  description: string;
  location: MenuLocation;
  items: MenuItem[];
}

const id = (n: number) => `tpl_${Date.now().toString(36)}_${n}`;

export const MENU_TEMPLATES: MenuTemplate[] = [
  {
    id: "header-simple",
    name: "Cabecera simple",
    description: "Inicio · Blog · Sobre · Contacto",
    location: "header",
    items: [
      { id: id(1), type: "link", label: "Inicio", href: "/" },
      { id: id(2), type: "link", label: "Blog", href: "/blog" },
      { id: id(3), type: "link", label: "Sobre", href: "/sobre" },
      { id: id(4), type: "link", label: "Contacto", href: "/contacto", highlight: true },
    ],
  },
  {
    id: "header-dropdowns",
    name: "Cabecera con desplegables",
    description: "Producto, Recursos y Compañía con submenú",
    location: "header",
    items: [
      {
        id: id(1),
        type: "link",
        label: "Producto",
        href: "#",
        children: [
          { id: id(2), type: "link", label: "Características", href: "/producto" },
          { id: id(3), type: "link", label: "Precios", href: "/precios" },
          { id: id(4), type: "link", label: "Integraciones", href: "/integraciones" },
        ],
      },
      {
        id: id(5),
        type: "link",
        label: "Recursos",
        href: "#",
        children: [
          { id: id(6), type: "collection", label: "Blog", collectionSlug: "posts" },
          { id: id(7), type: "link", label: "Documentación", href: "/docs" },
        ],
      },
      { id: id(8), type: "link", label: "Empezar", href: "/registro", highlight: true },
    ],
  },
  {
    id: "footer-columns",
    name: "Pie con columnas",
    description: "Producto / Compañía / Legal en columnas",
    location: "footer",
    items: [
      {
        id: id(1),
        type: "heading",
        label: "Producto",
        children: [
          { id: id(2), type: "link", label: "Características", href: "/producto" },
          { id: id(3), type: "link", label: "Precios", href: "/precios" },
          { id: id(4), type: "link", label: "Cambios", href: "/changelog" },
        ],
      },
      {
        id: id(5),
        type: "heading",
        label: "Compañía",
        children: [
          { id: id(6), type: "link", label: "Sobre", href: "/sobre" },
          { id: id(7), type: "link", label: "Contacto", href: "/contacto" },
          { id: id(8), type: "external", label: "GitHub", href: "https://github.com" },
        ],
      },
      {
        id: id(9),
        type: "heading",
        label: "Legal",
        children: [
          { id: id(10), type: "link", label: "Privacidad", href: "/privacidad" },
          { id: id(11), type: "link", label: "Términos", href: "/terminos" },
        ],
      },
    ],
  },
];
