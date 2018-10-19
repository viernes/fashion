# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Product Registration Denied',
    'version': '1.1',
    'category': 'Product',
    'sequence': 75,
    'summary': '',
    'description': "",
    'website': '',
    'images': [

    ],
    'depends': [
        'base',
        'product',
        'sale'
    ],
    'data': [
	'views/product_denied_views.xml'
    ],
    'demo': [

    ],
    'installable': True,
    'application': True,
    'auto_install': False,
    'qweb': [],
}
