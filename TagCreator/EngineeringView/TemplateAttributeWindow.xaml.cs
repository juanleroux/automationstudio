using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using gTools.Log;
using System.Collections.ObjectModel;
using MyControls;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for TemplateAttributeWindow.xaml
    /// </summary>
    public partial class TemplateAttributeWindow : WindowBase
    {
        #region Initialization

        private AttributeBase _currentAttribute;

        public TemplateAttributeWindow()
        {
            InitializeComponent();

            this.DataContext = this;
        }

        #endregion

        #region Properties

        public EngineeringParentProxy ParentProxy
        {
            get;
            set;
        }

        public MainWindow MainWindow
        {
            get;
            set;
        }

        #endregion

        #region Data Binding

        public AttributeBase CurrentAttribute
        {
            get
            {
                return _currentAttribute;
            }
            set
            {
                _currentAttribute = value;
                NotifyPropertyChanged("CurrentAttribute");
                NotifyPropertyChanged("IsCurrentAttribute");
                NotifyPropertyChanged("IsCurrentAttributeAndTemplateSelected");
                NotifyPropertyChanged("IsFirstItem");
                NotifyPropertyChanged("IsLastItem");
            }
        }

        public bool IsCurrentAttribute
        {
            get
            {
                return _currentAttribute != null;
            }
        }

        public bool IsCurrentAttributeAndTemplateSelected
        {
            get
            {
                return IsCurrentAttribute && ParentProxy.IsTemplateSelected;
            }
        }

        public bool IsFirstItem
        {
            get
            {
                int index = ParentProxy.GetAttributeIndex(_currentAttribute);

                return (index > 0);
            }
        }

        public bool IsLastItem
        {
            get
            {
                int index = ParentProxy.GetAttributeIndex(_currentAttribute);

                return (index < ParentProxy.CurrentTemplate.Attributes.Items.Count - 1);
            }
        }

        #endregion

        #region Events

        private void PreviousButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                int index = ParentProxy.GetAttributeIndex(_currentAttribute) - 1;

                if (index >= 0)
                {
                    if (ParentProxy.IsTemplateSelected)
                        CurrentAttribute = ParentProxy.CurrentTemplate.Attributes.Items[index];

                    if (ParentProxy.IsInstanceSelected)
                        CurrentAttribute = ParentProxy.CurrentInstance.Attributes.Items[index];
                }
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void NextButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                int index = ParentProxy.GetAttributeIndex(_currentAttribute) + 1;

                if (index < ParentProxy.CurrentTemplate.Attributes.Items.Count)
                {
                    if (ParentProxy.IsTemplateSelected)
                        CurrentAttribute = ParentProxy.CurrentTemplate.Attributes.Items[index];

                    if (ParentProxy.IsInstanceSelected)
                        CurrentAttribute = ParentProxy.CurrentInstance.Attributes.Items[index];
                }
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void AddAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                TemplateAttribute attribute = new TemplateAttribute()
                {
                    Id = ParentProxy.CurrentTemplate.Attributes.GetNextId(),
                    Parameter = _parameterCheckBox.IsChecked == true
				};
                ParentProxy.CurrentTemplate.AddAttribute(attribute);

                CurrentAttribute = attribute;
                _nameTextBox.Focus();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }
        /*
        private void DeleteAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (MainWindow.Confirm("Are you sure that you want to delete attribute {0}?", _currentAttribute.Name) != true)
                    return;

                int index = ParentProxy.CurrentTemplate.Attributes.Items.IndexOf((TemplateAttribute)_currentAttribute) - 1;
                ParentProxy.CurrentTemplate.RemoveAttribute((TemplateAttribute)_currentAttribute);
                
                if (index >= 0)
                    CurrentAttribute = ParentProxy.CurrentTemplate.Attributes.Items[index];
                else
                    CurrentAttribute = ParentProxy.CurrentTemplate.Attributes.Items.FirstOrDefault();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }
        */
        private void ReassignIds()
        {
            // Access the Items collection of the Attributes
            var attributes = ParentProxy.CurrentTemplate.Attributes.Items;

            // Reassign the IDs sequentially, starting from 1
            for (int i = 0; i < attributes.Count; i++)
            {
                attributes[i].Id = i + 1;
            }

            // If you had a DataGrid or similar component, you'd refresh it here
            // But since _dataGrid doesn't exist, this line can be removed
            // _dataGrid?.Items?.Refresh();
        }


        private void DeleteAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (MainWindow.Confirm("Are you sure that you want to delete attribute {0}?", _currentAttribute.Name) != true)
                    return;

                // Get the index of the current attribute
                int index = ParentProxy.CurrentTemplate.Attributes.Items.IndexOf((TemplateAttribute)_currentAttribute);

                // Remove the current attribute
                ParentProxy.CurrentTemplate.RemoveAttribute((TemplateAttribute)_currentAttribute);

                // Reassign IDs to the remaining attributes
                ReassignIds();

                // Update the current attribute to the previous one or first one if the deleted one was the last
                if (index >= 0 && ParentProxy.CurrentTemplate.Attributes.Items.Count > 0)
                    CurrentAttribute = ParentProxy.CurrentTemplate.Attributes.Items[Math.Max(index - 1, 0)];
                else
                    CurrentAttribute = null;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }


        private void DuplicateAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                TemplateAttribute attribute = new TemplateAttribute((TemplateAttribute)_currentAttribute) { Id = ParentProxy.CurrentTemplate.Attributes.GetNextId() };

                ParentProxy.CurrentTemplate.AddAttribute(attribute);

                CurrentAttribute = attribute;
                _nameTextBox.Focus();
                _nameTextBox.SelectAll();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void _valueTextBox_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
        {
            if (ParentProxy.IsTemplateSelected)
                ParentProxy.CurrentTemplate.UpdateLastModification();

            if (ParentProxy.IsInstanceSelected)
                ParentProxy.CurrentInstance.UpdateLastModification();
        }


        #endregion
    }
}
