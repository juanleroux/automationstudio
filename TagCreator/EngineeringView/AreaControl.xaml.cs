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
using System.Windows.Navigation;
using System.Windows.Shapes;
using gTools.Log;
using System.Collections;
using System.Collections.ObjectModel;
using System.Text.RegularExpressions;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for AttributesControl.xaml
    /// </summary>
    public partial class AreaControl : UserControl, INotifyPropertyChanged
    {
        #region Initialization

        public event PropertyChangedEventHandler PropertyChanged;
                
        public AreaControl()
        {
            InitializeComponent();

            this.DataContext = this;
        }

        #endregion

        #region Properties        

        #endregion

        #region Data Binding

        public EngineeringParentProxy ParentProxy
        {
            get;
            set;
        }

        #endregion

        #region Events

        private void DescriptionTextBlock_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ClickCount <= 1)
                return;

            if (ParentProxy.IsUserAreaSelected == false)
                return;

            _descriptionEditTextBox.Visibility = System.Windows.Visibility.Visible;
            _descriptionEditTextBox.Focus();
        }

        private void _descriptionEditTextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                _descriptionEditTextBox.Visibility = System.Windows.Visibility.Hidden;
                Keyboard.ClearFocus();
            }
        }

        private void _descriptionEditTextBox_LostFocus(object sender, RoutedEventArgs e)
        {
            _descriptionEditTextBox.Visibility = System.Windows.Visibility.Hidden;
        }

        #endregion

        #region Methods

        /// <summary>
        /// WPF data change notification
        /// </summary>
        /// <param name="property"></param>
        public void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }        

        #endregion                             
    }
}
