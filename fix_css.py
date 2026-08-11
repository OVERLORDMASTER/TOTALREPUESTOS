from pathlib import Path

path = Path(r'c:\Users\OVERLORD\Desktop\Nueva carpeta\style.css')
text = path.read_text(encoding='utf-8')
old = '''    /* Para que los botones y buscadores en el header móvil sean uniformes */
    .header-actions .action-btn,
    .header-actions input[type="text"] {
        width: 100%;
        justify-content: center;
        height: 44px; /* Altura uniforme para que se vean parejos */
        font-size: 0.8rem; /* Reducir fuente para que quepa el texto */
        padding: 10px 8px;
    }

    .header-actions .action-btn {
        white-space: nowrap; /* Evita que el texto del botón se parta en dos líneas */
    }

    /* Específico para la vista de Inventario: buscador a todo lo ancho */
    .header-actions #productSearch {
        grid-column: 1 / -1;
    }
'''
new = '''    /* Para que los botones y buscadores en el header móvil sean uniformes */
    .header-actions .action-btn,
    .header-actions input[type="text"] {
        width: 100%;
        justify-content: center;
        height: 44px; /* Altura uniforme para que se vean parejos */
        font-size: 0.8rem; /* Reducir fuente para que quepa el texto */
        padding: 10px 8px;
    }

    .header-actions .action-btn {
        white-space: nowrap; /* Evita que el texto del botón se parta en dos líneas */
    }

    /* Específico para la vista de Inventario: buscador a todo lo ancho */
    .header-actions #productSearch {
        grid-column: 1 / -1;
    }

    /* Inventario: botones iguales y buscador debajo */
    .inventario-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        width: 100%;
        align-items: center;
    }

    .inventario-actions .btn-cat {
        grid-column: 1 / -1;
    }

    .inventario-actions #productSearch {
        grid-column: 1 / -1;
    }

    /* Caja: botones en una fila igual y buscador en fila completa */
    .caja-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        width: 100%;
        align-items: center;
    }

    .caja-actions #cajaProductSearch {
        grid-column: 1 / -1;
    }
'''

if old not in text:
    print('Old block not found')
    raise SystemExit(1)

path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Replaced first occurrence')
